/*
 * Arduino Mega Real-Time GPS Tracker with SIM800L 2G
 * Fallback implementation using HTTP POST protocol
 * 
 * Features:
 * - TinyGPSPlus with NEO-6M GPS module
 * - SIM800L 2G module for HTTP communication
 * - Robust AT command handling with retries
 * - Offline data buffering
 * - Power management and reconnection logic
 * 
 * Dependencies:
 * - TinyGPSPlus library
 * - SoftwareSerial library (built-in)
 */

#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>
#include "config.h"

// GPS Module (NEO-6M)
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

// SIM800L Module
SoftwareSerial sim800l(SIM800L_RX_PIN, SIM800L_TX_PIN);

// State variables
bool gpsValid = false;
bool sim800lReady = false;
bool httpConnected = false;
unsigned long lastGpsUpdate = 0;
unsigned long lastHttpPost = 0;
unsigned long lastHeartbeat = 0;
unsigned long sim800lReconnectAttempt = 0;

// GPS data
struct GpsData {
  double lat = 0.0;
  double lng = 0.0;
  float speed = 0.0;
  float heading = 0.0;
  int satellites = 0;
  unsigned long timestamp = 0;
};

GpsData currentGpsData;

// Movement detection
bool isMoving = false;
float lastLat = 0.0;
float lastLng = 0.0;
unsigned long lastMovementCheck = 0;

// Offline data buffer
String offlineBuffer = "";
int offlineBufferCount = 0;

void setup() {
  Serial.begin(9600);
  delay(2000);
  
  Serial.println("=== Arduino Mega GPS Tracker Starting ===");
  
  // Initialize GPS
  initGPS();
  
  // Initialize SIM800L
  initSIM800L();
  
  Serial.println("=== Setup Complete ===");
}

void loop() {
  // Update GPS data
  updateGPS();
  
  // Check SIM800L connection
  checkSIM800L();
  
  // Send GPS data via HTTP
  sendGPSData();
  
  // Send heartbeat
  sendHeartbeat();
  
  // Process offline buffer
  processOfflineBuffer();
  
  delay(1000);
}

void initGPS() {
  Serial.println("Initializing GPS...");
  gpsSerial.begin(9600);
  delay(2000);
  
  // Wait for GPS to get fix
  Serial.println("Waiting for GPS fix...");
  unsigned long startTime = millis();
  while (millis() - startTime < 30000) { // Wait up to 30 seconds
    while (gpsSerial.available()) {
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid()) {
          Serial.println("GPS fix acquired!");
          gpsValid = true;
          return;
        }
      }
    }
    delay(100);
  }
  
  Serial.println("GPS initialization timeout - will retry in main loop");
}

void initSIM800L() {
  Serial.println("Initializing SIM800L...");
  sim800l.begin(9600);
  delay(2000);
  
  // Power on sequence
  digitalWrite(SIM800L_PWR_PIN, HIGH);
  delay(1000);
  digitalWrite(SIM800L_PWR_PIN, LOW);
  delay(5000); // Wait for module to boot
  
  // Send AT commands with retries
  if (sendATCommand("AT", 5000)) {
    Serial.println("SIM800L responding");
    
    // Check SIM card
    if (sendATCommand("AT+CPIN?", 5000)) {
      Serial.println("SIM card ready");
      
      // Check network registration
      if (sendATCommand("AT+CREG?", 5000)) {
        Serial.println("Network registered");
        sim800lReady = true;
        
        // Setup GPRS connection
        setupGPRS();
      }
    }
  } else {
    Serial.println("SIM800L initialization failed");
  }
}

void setupGPRS() {
  Serial.println("Setting up GPRS connection...");
  
  // Set APN
  String apnCmd = "AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"";
  if (sendATCommand(apnCmd, 10000)) {
    
    // Open bearer
    if (sendATCommand("AT+SAPBR=1,1", 10000)) {
      
      // Get IP address
      if (sendATCommand("AT+SAPBR=2,1", 5000)) {
        httpConnected = true;
        Serial.println("GPRS connection established");
      }
    }
  }
}

void updateGPS() {
  while (gpsSerial.available()) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid()) {
        currentGpsData.lat = gps.location.lat();
        currentGpsData.lng = gps.location.lng();
        currentGpsData.speed = gps.speed.kmph();
        currentGpsData.heading = gps.course.deg();
        currentGpsData.satellites = gps.satellites.value();
        currentGpsData.timestamp = millis();
        gpsValid = true;
        lastGpsUpdate = millis();
        
        checkMovement();
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

void sendGPSData() {
  if (!gpsValid || !httpConnected) return;
  
  unsigned long now = millis();
  unsigned long interval = isMoving ? MOVING_INTERVAL_MS : IDLE_INTERVAL_MS;
  
  if (now - lastHttpPost >= interval) {
    
    // Create JSON payload
    String payload = "{";
    payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"lat\":" + String(currentGpsData.lat, 6) + ",";
    payload += "\"lng\":" + String(currentGpsData.lng, 6) + ",";
    payload += "\"speed\":" + String(currentGpsData.speed, 1) + ",";
    payload += "\"heading\":" + String(currentGpsData.heading, 1) + ",";
    payload += "\"sats\":" + String(currentGpsData.satellites) + ",";
    payload += "\"ts\":" + String(currentGpsData.timestamp) + ",";
    payload += "\"src\":\"sim800l\"";
    payload += "}";
    
    // Send HTTP POST
    if (sendHttpPost(payload)) {
      Serial.println("GPS data sent: " + payload);
      lastHttpPost = now;
    } else {
      Serial.println("Failed to send GPS data - storing offline");
      storeOfflineData(payload);
    }
  }
}

bool sendHttpPost(String payload) {
  if (!httpConnected) return false;
  
  // Prepare HTTP POST request
  String url = "http://" + String(SERVER_HOST) + "/api/track?token=" + String(DEVICE_TOKEN);
  
  // Start HTTP session
  String httpCmd = "AT+HTTPINIT";
  if (!sendATCommand(httpCmd, 5000)) return false;
  
  // Set HTTP parameters
  httpCmd = "AT+HTTPPARA=\"URL\",\"" + url + "\"";
  if (!sendATCommand(httpCmd, 5000)) return false;
  
  httpCmd = "AT+HTTPPARA=\"CONTENT\",\"application/json\"";
  if (!sendATCommand(httpCmd, 5000)) return false;
  
  // Add device token header
  httpCmd = "AT+HTTPPARA=\"USERDATA\",\"X-Device-Token: " + String(DEVICE_TOKEN) + "\"";
  sendATCommand(httpCmd, 5000);
  
  // Set data length
  httpCmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
  if (!sendATCommand(httpCmd, 5000)) return false;
  
  // Send payload
  sim800l.print(payload);
  delay(2000);
  
  // Send HTTP request
  httpCmd = "AT+HTTPACTION=1";
  if (!sendATCommand(httpCmd, 15000)) return false;
  
  // Read response
  String response = "";
  unsigned long timeout = millis() + 10000;
  while (millis() < timeout) {
    if (sim800l.available()) {
      response += (char)sim800l.read();
      if (response.indexOf("200") >= 0) {
        // Success
        sendATCommand("AT+HTTPTERM", 5000);
        return true;
      }
    }
  }
  
  // Terminate HTTP session
  sendATCommand("AT+HTTPTERM", 5000);
  return false;
}

void sendHeartbeat() {
  unsigned long now = millis();
  if (now - lastHeartbeat >= 60000) { // Every minute
    
    String payload = "{";
    payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"type\":\"heartbeat\",";
    payload += "\"timestamp\":" + String(now) + ",";
    payload += "\"gps_valid\":" + String(gpsValid ? "true" : "false") + ",";
    payload += "\"sim800l_ready\":" + String(sim800lReady ? "true" : "false") + ",";
    payload += "\"http_connected\":" + String(httpConnected ? "true" : "false") + ",";
    payload += "\"offline_buffer_count\":" + String(offlineBufferCount);
    payload += "}";
    
    if (httpConnected) {
      sendHttpPost(payload);
    } else {
      storeOfflineData(payload);
    }
    
    lastHeartbeat = now;
  }
}

void checkSIM800L() {
  if (!sim800lReady && millis() - sim800lReconnectAttempt > 60000) {
    Serial.println("Attempting SIM800L reconnection...");
    initSIM800L();
    sim800lReconnectAttempt = millis();
  }
}

void storeOfflineData(String payload) {
  if (offlineBufferCount < MAX_OFFLINE_RECORDS) {
    offlineBuffer += payload + "\n";
    offlineBufferCount++;
    Serial.println("Stored offline data (" + String(offlineBufferCount) + "/" + String(MAX_OFFLINE_RECORDS) + ")");
  }
}

void processOfflineBuffer() {
  if (offlineBufferCount > 0 && httpConnected) {
    Serial.println("Processing offline buffer...");
    
    // Send each stored record
    int newlinePos = 0;
    while ((newlinePos = offlineBuffer.indexOf('\n')) >= 0) {
      String payload = offlineBuffer.substring(0, newlinePos);
      offlineBuffer = offlineBuffer.substring(newlinePos + 1);
      
      if (sendHttpPost(payload)) {
        offlineBufferCount--;
        Serial.println("Sent offline data (" + String(offlineBufferCount) + " remaining)");
      } else {
        break; // Stop if sending fails
      }
      
      delay(2000); // Rate limiting
    }
  }
}

bool sendATCommand(String command, unsigned long timeout) {
  Serial.println("AT: " + command);
  sim800l.println(command);
  
  unsigned long startTime = millis();
  String response = "";
  
  while (millis() - startTime < timeout) {
    if (sim800l.available()) {
      char c = sim800l.read();
      response += c;
      
      // Check for OK or ERROR
      if (response.indexOf("OK") >= 0) {
        Serial.println("Response: " + response);
        return true;
      } else if (response.indexOf("ERROR") >= 0) {
        Serial.println("Response: " + response);
        return false;
      }
    }
  }
  
  Serial.println("Response: " + response + " (timeout)");
  return false;
}

/*
 * WIRING DIAGRAM
 * 
 * Arduino Mega ↔ SIM800L:
 * Mega Digital Pin 10 → SIM800L TX (via voltage divider 10kΩ + 20kΩ)
 * Mega Digital Pin 11 → SIM800L RX (direct connection)
 * Mega Digital Pin 12 → SIM800L PWR_PIN
 * Mega GND            → SIM800L GND
 * Mega 5V             → SIM800L VCC (via 1N4007 diode for 4.2V)
 * 
 * Arduino Mega ↔ NEO-6M:
 * Mega Digital Pin 8  → NEO-6M TX
 * Mega Digital Pin 9  → NEO-6M RX  
 * Mega 5V             → NEO-6M VCC
 * Mega GND            → NEO-6M GND
 * 
 * POWER REQUIREMENTS:
 * - SIM800L: 4.2V, 2A peak current
 * - Add 1000µF capacitor near SIM800L power pins
 * - Use voltage regulator or diode for proper voltage
 * - Add ferrite beads on power lines
 * - Consider separate power supply for SIM800L
 * 
 * VOLTAGE DIVIDER FOR TX:
 * SIM800L TX → 10kΩ resistor → Mega Pin 10
 *                    ↓
 *                 20kΩ resistor → GND
 * 
 * This creates 3.3V from SIM800L's 5V output
 */
