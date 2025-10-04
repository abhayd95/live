/*
 * Example Configuration for ESP32 GPS Tracker
 * Copy this to config.h and update with your values
 */

#ifndef CONFIG_H
#define CONFIG_H

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

// Wi-Fi Settings (ESP32 only)
#define WIFI_SSID "YourWiFiNetwork"
#define WIFI_PASS "YourWiFiPassword"

// Server Configuration
#define SERVER_HOST "your-server.com"  // or IP address
#define PUBLIC_ORIGIN "http://your-server.com"

// MQTT Configuration (ESP32 only)
#define MQTT_BROKER_HOST "your-mqtt-broker.com"  // or IP address
#define MQTT_PORT 1883
#define MQTT_USERNAME "mqtt_user"
#define MQTT_PASSWORD "mqtt_password"

// Device Configuration
#define DEVICE_ID "ESP32_TRACKER_001"
#define DEVICE_TOKEN "test_token_123"  // Must match server config

// =============================================================================
// HARDWARE PIN CONFIGURATION
// =============================================================================

// ESP32 Pin Definitions
#ifdef ESP32
  // SIM7600 UART Pins
  #define SIM7600_RX_PIN 4
  #define SIM7600_TX_PIN 5
  #define SIM7600_PWR_PIN 12
  
  // Optional NEO-6M GPS Pins
  #define NEO6M_RX_PIN 16
  #define NEO6M_TX_PIN 17
#endif

// =============================================================================
// SIM CARD CONFIGURATION
// =============================================================================

// APN Settings (Update for your carrier)
#define APN "internet"  // Common APN for most carriers

// Carrier-specific APN Examples:
// AT&T: "broadband"
// Verizon: "vzwinternet" 
// T-Mobile: "fast.t-mobile.com"
// Orange: "orange"
// Vodafone: "internet"

// =============================================================================
// OPERATIONAL PARAMETERS
// =============================================================================

// Timing Configuration
#define MOVING_INTERVAL_MS 15000    // 15 seconds when moving
#define IDLE_INTERVAL_MS 60000      // 60 seconds when idle
#define HEARTBEAT_INTERVAL_MS 60000 // 1 minute heartbeat
#define RECONNECT_DELAY_MS 10000    // 10 seconds between reconnection attempts

// GPS Configuration
#define GPS_BAUD_RATE 9600
#define GPS_TIMEOUT_MS 30000        // 30 seconds GPS timeout
#define MOVEMENT_THRESHOLD_M 10.0   // 10 meters movement threshold

// Network Configuration
#define WIFI_TIMEOUT_MS 20000       // 20 seconds WiFi timeout
#define HTTP_TIMEOUT_MS 15000       // 15 seconds HTTP timeout
#define AT_COMMAND_TIMEOUT_MS 5000  // 5 seconds AT command timeout

// Offline Storage
#define MAX_OFFLINE_RECORDS 50      // Maximum offline records to store
#define OFFLINE_BUFFER_SIZE 8192    // 8KB buffer size

// =============================================================================
// DEBUGGING AND LOGGING
// =============================================================================

// Debug Levels
#define DEBUG_LEVEL_ERROR 0
#define DEBUG_LEVEL_WARN  1
#define DEBUG_LEVEL_INFO  2
#define DEBUG_LEVEL_DEBUG 3

// Set debug level (0-3)
#define DEBUG_LEVEL DEBUG_LEVEL_INFO

// Debug macros
#if DEBUG_LEVEL >= DEBUG_LEVEL_ERROR
  #define DEBUG_ERROR(x) Serial.println("[ERROR] " + String(x))
#else
  #define DEBUG_ERROR(x)
#endif

#if DEBUG_LEVEL >= DEBUG_LEVEL_WARN
  #define DEBUG_WARN(x) Serial.println("[WARN] " + String(x))
#else
  #define DEBUG_WARN(x)
#endif

#if DEBUG_LEVEL >= DEBUG_LEVEL_INFO
  #define DEBUG_INFO(x) Serial.println("[INFO] " + String(x))
#else
  #define DEBUG_INFO(x)
#endif

#if DEBUG_LEVEL >= DEBUG_LEVEL_DEBUG
  #define DEBUG_DEBUG(x) Serial.println("[DEBUG] " + String(x))
#else
  #define DEBUG_DEBUG(x)
#endif

// =============================================================================
// FEATURE FLAGS
// =============================================================================

// Enable/disable features
#define ENABLE_WIFI_FALLBACK true   // ESP32: Enable WiFi as primary connection
#define ENABLE_LTE_FALLBACK true    // ESP32: Enable LTE as fallback
#define ENABLE_NEO6M_FALLBACK true  // ESP32: Enable external GPS fallback
#define ENABLE_OFFLINE_STORAGE true // Enable offline data buffering
#define ENABLE_HEARTBEAT true       // Enable heartbeat messages
#define ENABLE_MOVEMENT_DETECTION true // Enable movement-based intervals

#endif // CONFIG_H
