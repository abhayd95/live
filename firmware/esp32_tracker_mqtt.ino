/*
 * ESP32 Real-Time GPS Tracker with SIM7600 4G LTE
 * Primary implementation using MQTT protocol
 * 
 * Features:
 * - SIM7600 internal GNSS (primary)
 * - Optional NEO-6M external GPS (fallback)
 * - Wi-Fi to LTE failover
 * - MQTT publishing with offline buffering
 * - Power management and reconnection logic
 * 
 * Dependencies:
 * - TinyGPSPlus library
 * - PubSubClient library
 * - SPIFFS support
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPSPlus.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include "config.h"

// Hardware Serial for SIM7600
HardwareSerial sim7600(2);

// Optional external GPS via SoftwareSerial
#include <SoftwareSerial.h>
SoftwareSerial neo6m(NEO6M_RX_PIN, NEO6M_TX_PIN);

// GPS objects
TinyGPSPlus sim7600_gps;
TinyGPSPlus neo6m_gps;

// Network clients
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// State variables
bool wifiConnected = false;
bool lteConnected = false;
bool gpsValid = false;
bool mqttConnected = false;
unsigned long lastGpsUpdate = 0;
unsigned long lastMqttPublish = 0;
unsigned long lastHeartbeat = 0;
unsigned long wifiReconnectAttempt = 0;
unsigned long lteReconnectAttempt = 0;
unsigned long mqttReconnectAttempt = 0;

// GPS data
struct GpsData {
  double lat = 0.0;
  double lng = 0.0;
  float speed = 0.0;
  float heading = 0.0;
  int satellites = 0;
  String source = "unknown";
  unsigned long timestamp = 0;
};

GpsData currentGpsData;

// Movement detection
bool isMoving = false;
float lastLat = 0.0;
float lastLng = 0.0;
unsigned long lastMovementCheck = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== ESP32 GPS Tracker Starting ===");
  
  // Initialize SPIFFS for offline buffering
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
  }
  
  // Initialize SIM7600
  initSIM7600();
  
  // Initialize optional NEO-6M
  initNEO6M();
  
  // Connect to networks
  connectToWiFi();
  if (!wifiConnected) {
    connectToLTE();
  }
  
  // Setup MQTT
  setupMQTT();
  
  // Load offline queue
  loadOfflineQueue();
  
  Serial.println("=== Setup Complete ===");
}

void loop() {
  // Update GPS data
  updateGPS();
  
  // Check network connections
  checkConnections();
  
  // Publish GPS data
  publishGPSData();
  
  // Handle MQTT loop
  if (mqttConnected) {
    mqttClient.loop();
  }
  
  // Send heartbeat
  sendHeartbeat();
  
  // Small delay
  delay(100);
}

void initSIM7600() {
  Serial.println("Initializing SIM7600...");
  sim7600.begin(115200, SERIAL_8N1, SIM7600_RX_PIN, SIM7600_TX_PIN);
  delay(2000);
  
  // Power on sequence
  digitalWrite(SIM7600_PWR_PIN, HIGH);
  delay(1000);
  digitalWrite(SIM7600_PWR_PIN, LOW);
  delay(3000);
  
  // Send AT commands
  sendATCommand("AT");
  delay(1000);
  sendATCommand("AT+CPIN?");
  delay(1000);
  sendATCommand("AT+CREG?");
  delay(1000);
  sendATCommand("AT+CGREG?");
  delay(1000);
  
  // Enable GNSS
  sendATCommand("AT+CGNSPWR=1");
  delay(2000);
  sendATCommand("AT+CGNSINF");
  
  Serial.println("SIM7600 initialized");
}

void initNEO6M() {
  Serial.println("Initializing NEO-6M GPS...");
  neo6m.begin(9600);
  delay(1000);
  Serial.println("NEO-6M GPS initialized");
}

void connectToWiFi() {
  Serial.println("Attempting WiFi connection...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("");
    Serial.println("WiFi connection failed");
  }
}

void connectToLTE() {
  Serial.println("Setting up LTE connection...");
  
  // Set APN
  sendATCommand("AT+CGDCONT=1,\"IP\",\"" + String(APN) + "\"");
  delay(2000);
  
  // Activate PDP context
  sendATCommand("AT+CGACT=1,1");
  delay(3000);
  
  // Get IP address
  String response = sendATCommand("AT+CGPADDR=1");
  if (response.indexOf("+CGPADDR:") >= 0) {
    lteConnected = true;
    Serial.println("LTE connected!");
  } else {
    lteConnected = false;
    Serial.println("LTE connection failed");
  }
}

void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(30);
  
  connectMQTT();
}

void connectMQTT() {
  if (!mqttConnected) {
    Serial.println("Connecting to MQTT broker...");
    
    String clientId = "ESP32_" + String(DEVICE_ID) + "_" + String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      mqttConnected = true;
      Serial.println("MQTT connected!");
      
      // Subscribe to any control topics if needed
      String controlTopic = "control/" + String(DEVICE_ID);
      mqttClient.subscribe(controlTopic.c_str());
      
    } else {
      mqttConnected = false;
      Serial.print("MQTT connection failed, rc=");
      Serial.println(mqttClient.state());
    }
  }
}

void updateGPS() {
  // Try SIM7600 GPS first
  while (sim7600.available()) {
    if (sim7600_gps.encode(sim7600.read())) {
      if (sim7600_gps.location.isValid()) {
        currentGpsData.lat = sim7600_gps.location.lat();
        currentGpsData.lng = sim7600_gps.location.lng();
        currentGpsData.speed = sim7600_gps.speed.kmph();
        currentGpsData.heading = sim7600_gps.course.deg();
        currentGpsData.satellites = sim7600_gps.satellites.value();
        currentGpsData.source = "sim7600";
        currentGpsData.timestamp = millis();
        gpsValid = true;
        lastGpsUpdate = millis();
        
        checkMovement();
        return;
      }
    }
  }
  
  // Fallback to NEO-6M
  while (neo6m.available()) {
    if (neo6m_gps.encode(neo6m.read())) {
      if (neo6m_gps.location.isValid()) {
        currentGpsData.lat = neo6m_gps.location.lat();
        currentGpsData.lng = neo6m_gps.location.lng();
        currentGpsData.speed = neo6m_gps.speed.kmph();
        currentGpsData.heading = neo6m_gps.course.deg();
        currentGpsData.satellites = neo6m_gps.satellites.value();
        currentGpsData.source = "neo6m";
        currentGpsData.timestamp = millis();
        gpsValid = true;
        lastGpsUpdate = millis();
        
        checkMovement();
        return;
      }
    }
  }
}

void checkMovement() {
  unsigned long now = millis();
  if (now - lastMovementCheck > 5000) { // Check every 5 seconds
    
    if (lastLat != 0 && lastLng != 0) {
      // Calculate distance moved
      float distance = TinyGPSPlus::distanceBetween(
        currentGpsData.lat, currentGpsData.lng,
        lastLat, lastLng
      );
      
      isMoving = (distance > 10.0); // 10 meters threshold
    }
    
    lastLat = currentGpsData.lat;
    lastLng = currentGpsData.lng;
    lastMovementCheck = now;
  }
}

void publishGPSData() {
  if (!gpsValid || !mqttConnected) return;
  
  unsigned long now = millis();
  unsigned long interval = isMoving ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;
  
  if (now - lastMqttPublish >= interval) {
    
    // Create JSON payload
    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["lat"] = currentGpsData.lat;
    doc["lng"] = currentGpsData.lng;
    doc["speed"] = currentGpsData.speed;
    doc["heading"] = currentGpsData.heading;
    doc["sats"] = currentGpsData.satellites;
    doc["ts"] = currentGpsData.timestamp;
    doc["src"] = currentGpsData.source;
    
    String payload;
    serializeJson(doc, payload);
    
    // Publish to MQTT
    String topic = "track/" + String(DEVICE_ID);
    if (mqttClient.publish(topic.c_str(), payload.c_str())) {
      Serial.println("GPS data published: " + payload);
      lastMqttPublish = now;
    } else {
      Serial.println("Failed to publish GPS data");
      // Store in offline queue
      storeOfflineData(payload);
    }
  }
}

void sendHeartbeat() {
  unsigned long now = millis();
  if (now - lastHeartbeat >= 60000) { // Every minute
    
    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["type"] = "heartbeat";
    doc["timestamp"] = now;
    doc["wifi_connected"] = wifiConnected;
    doc["lte_connected"] = lteConnected;
    doc["gps_valid"] = gpsValid;
    doc["mqtt_connected"] = mqttConnected;
    doc["free_heap"] = ESP.getFreeHeap();
    
    String payload;
    serializeJson(doc, payload);
    
    String topic = "heartbeat/" + String(DEVICE_ID);
    mqttClient.publish(topic.c_str(), payload.c_str());
    
    lastHeartbeat = now;
  }
}

void checkConnections() {
  // Check WiFi
  if (wifiConnected && WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    Serial.println("WiFi connection lost");
    wifiReconnectAttempt = millis();
  } else if (!wifiConnected && millis() - wifiReconnectAttempt > 30000) {
    connectToWiFi();
    wifiReconnectAttempt = millis();
  }
  
  // Check LTE if WiFi not available
  if (!wifiConnected && !lteConnected && millis() - lteReconnectAttempt > 60000) {
    connectToLTE();
    lteReconnectAttempt = millis();
  }
  
  // Check MQTT
  if (!mqttClient.connected()) {
    mqttConnected = false;
    if (millis() - mqttReconnectAttempt > 10000) {
      connectMQTT();
      mqttReconnectAttempt = millis();
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Handle control messages
  if (String(topic).indexOf("control/") >= 0) {
    JsonDocument doc;
    deserializeJson(doc, message);
    
    if (doc["command"] == "reset") {
      Serial.println("Received reset command");
      ESP.restart();
    }
  }
}

String sendATCommand(String command) {
  sim7600.println(command);
  delay(1000);
  
  String response = "";
  while (sim7600.available()) {
    response += (char)sim7600.read();
  }
  
  Serial.println("AT: " + command);
  Serial.println("Response: " + response);
  
  return response;
}

void storeOfflineData(String payload) {
  File file = SPIFFS.open("/queue.txt", FILE_APPEND);
  if (file) {
    file.println(payload);
    file.close();
  }
}

void loadOfflineQueue() {
  if (SPIFFS.exists("/queue.txt")) {
    File file = SPIFFS.open("/queue.txt", FILE_READ);
    if (file) {
      while (file.available()) {
        String payload = file.readStringUntil('\n');
        if (payload.length() > 0 && mqttConnected) {
          String topic = "track/" + String(DEVICE_ID);
          mqttClient.publish(topic.c_str(), payload.c_str());
        }
      }
      file.close();
      SPIFFS.remove("/queue.txt");
      Serial.println("Offline queue processed");
    }
  }
}

/*
 * WIRING DIAGRAM
 * 
 * ESP32 ↔ SIM7600:
 * ESP32 GPIO4  → SIM7600 UART_TX
 * ESP32 GPIO5  → SIM7600 UART_RX  
 * ESP32 GPIO12 → SIM7600 PWR_PIN
 * ESP32 GND    → SIM7600 GND
 * ESP32 5V     → SIM7600 VCC (4.1V recommended)
 * 
 * ESP32 ↔ NEO-6M (Optional):
 * ESP32 GPIO16 → NEO-6M TX
 * ESP32 GPIO17 → NEO-6M RX
 * ESP32 3.3V   → NEO-6M VCC
 * ESP32 GND    → NEO-6M GND
 * 
 * POWER REQUIREMENTS:
 * - SIM7600: 4.1V, 2A peak current
 * - Add 1000-2200µF capacitor near SIM7600 power pins
 * - Use reverse polarity protection diode
 * - Add ferrite beads on power lines
 * - Consider separate power supply for SIM7600
 */
