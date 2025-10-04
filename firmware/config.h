/*
 * Configuration file for GPS Tracker Firmware
 * Update all <PLACEHOLDER> values before flashing
 */

#ifndef CONFIG_H
#define CONFIG_H

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

// Wi-Fi Settings (ESP32 only)
#define WIFI_SSID "<WIFI_SSID>"
#define WIFI_PASS "<WIFI_PASS>"

// Server Configuration
#define SERVER_HOST "<SERVER_HOST>"
#define PUBLIC_ORIGIN "<PUBLIC_ORIGIN>"

// MQTT Configuration (ESP32 only)
#define MQTT_BROKER_HOST "<MQTT_BROKER_HOST>"
#define MQTT_PORT 1883
#define MQTT_USERNAME "<MQTT_USERNAME>"
#define MQTT_PASSWORD "<MQTT_PASSWORD>"

// Device Configuration
#define DEVICE_ID "<DEVICE_ID>"
#define DEVICE_TOKEN "<DEVICE_TOKEN>"

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

// Arduino Mega Pin Definitions
#ifdef ARDUINO_AVR_MEGA2560
  // SIM800L UART Pins
  #define SIM800L_RX_PIN 10
  #define SIM800L_TX_PIN 11
  #define SIM800L_PWR_PIN 12
  
  // NEO-6M GPS Pins
  #define GPS_RX_PIN 8
  #define GPS_TX_PIN 9
#endif

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
// SIM CARD CONFIGURATION
// =============================================================================

// APN Settings (Update for your carrier)
#define APN "<APN>"

// Common APN Examples:
// AT&T: "broadband"
// Verizon: "vzwinternet" 
// T-Mobile: "fast.t-mobile.com"
// Orange: "orange"
// Vodafone: "internet"
// Generic: "internet"

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

// =============================================================================
// VALIDATION MACROS
// =============================================================================

// Check if required placeholders are set
#if WIFI_SSID == "<WIFI_SSID>"
  #error "Please set WIFI_SSID in config.h"
#endif

#if SERVER_HOST == "<SERVER_HOST>"
  #error "Please set SERVER_HOST in config.h"
#endif

#if DEVICE_ID == "<DEVICE_ID>"
  #error "Please set DEVICE_ID in config.h"
#endif

#if DEVICE_TOKEN == "<DEVICE_TOKEN>"
  #error "Please set DEVICE_TOKEN in config.h"
#endif

#if APN == "<APN>"
  #error "Please set APN in config.h"
#endif

// ESP32 specific validation
#ifdef ESP32
  #if MQTT_BROKER_HOST == "<MQTT_BROKER_HOST>"
    #error "Please set MQTT_BROKER_HOST in config.h"
  #endif
  
  #if MQTT_USERNAME == "<MQTT_USERNAME>"
    #error "Please set MQTT_USERNAME in config.h"
  #endif
  
  #if MQTT_PASSWORD == "<MQTT_PASSWORD>"
    #error "Please set MQTT_PASSWORD in config.h"
  #endif
#endif

#endif // CONFIG_H
