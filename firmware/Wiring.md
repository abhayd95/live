# GPS Tracker Hardware Wiring Guide

This document provides detailed wiring diagrams and power requirements for both ESP32 and Arduino Mega GPS tracker implementations.

## Table of Contents
- [ESP32 + SIM7600 Setup](#esp32--sim7600-setup)
- [Arduino Mega + SIM800L Setup](#arduino-mega--sim800l-setup)
- [Power Requirements](#power-requirements)
- [Safety Considerations](#safety-considerations)
- [Troubleshooting](#troubleshooting)

## ESP32 + SIM7600 Setup

### Pin Connections

```
ESP32 DevKit V1        SIM7600 4G Module
├── GPIO4  ────────────► UART_TX
├── GPIO5  ────────────► UART_RX
├── GPIO12 ────────────► PWR_PIN
├── 5V     ────────────► VCC (4.1V recommended)
└── GND    ────────────► GND

Optional NEO-6M GPS:
├── GPIO16 ────────────► NEO-6M TX
├── GPIO17 ────────────► NEO-6M RX
├── 3.3V   ────────────► NEO-6M VCC
└── GND    ────────────► NEO-6M GND
```

### ASCII Wiring Diagram

```
                    ESP32 DevKit V1
                    ┌─────────────────┐
                    │ 3.3V  │ 5V     │
                    │ GND   │ GND    │
                    │ GPIO4 │ GPIO5  │
                    │ GPIO12│ GPIO16 │
                    │ GPIO17│        │
                    └───────┼────────┘
                            │
                    ┌───────┼────────┐
                    │       │        │
                    │   SIM7600      │
                    │   ┌─────────┐  │
                    │   │ UART_TX │  │
                    │   │ UART_RX │  │
                    │   │ PWR_PIN │  │
                    │   │ VCC     │  │
                    │   │ GND     │  │
                    │   └─────────┘  │
                    │                │
                    │   NEO-6M GPS   │
                    │   ┌─────────┐  │
                    │   │ TX      │  │
                    │   │ RX      │  │
                    │   │ VCC     │  │
                    │   │ GND     │  │
                    │   └─────────┘  │
                    └────────────────┘
```

## Arduino Mega + SIM800L Setup

### Pin Connections

```
Arduino Mega 2560      SIM800L 2G Module
├── Digital Pin 10 ────► TX (via voltage divider)
├── Digital Pin 11 ────► RX (direct)
├── Digital Pin 12 ────► PWR_PIN
├── 5V ───────────────► VCC (via diode for 4.2V)
└── GND ──────────────► GND

NEO-6M GPS:
├── Digital Pin 8  ────► NEO-6M TX
├── Digital Pin 9  ────► NEO-6M RX
├── 5V ───────────────► NEO-6M VCC
└── GND ──────────────► NEO-6M GND
```

### Voltage Divider for SIM800L TX

```
SIM800L TX (5V) ──── 10kΩ ──── Arduino Pin 10
                           │
                        20kΩ
                           │
                         GND
```

This creates a voltage divider that converts SIM800L's 5V output to 3.3V for Arduino.

### ASCII Wiring Diagram

```
                    Arduino Mega 2560
                    ┌─────────────────┐
                    │ 5V  │ GND       │
                    │ D8  │ D9        │
                    │ D10 │ D11       │
                    │ D12 │           │
                    └─────┼───────────┘
                          │
                    ┌─────┼───────────┐
                    │     │           │
                    │   SIM800L       │
                    │   ┌─────────┐   │
                    │   │ TX      │   │
                    │   │ RX      │   │
                    │   │ PWR_PIN │   │
                    │   │ VCC     │   │
                    │   │ GND     │   │
                    │   └─────────┘   │
                    │                 │
                    │   NEO-6M GPS    │
                    │   ┌─────────┐   │
                    │   │ TX      │   │
                    │   │ RX      │   │
                    │   │ VCC     │   │
                    │   │ GND     │   │
                    │   └─────────┘   │
                    └─────────────────┘
```

## Power Requirements

### ESP32 + SIM7600
- **ESP32**: 3.3V, ~240mA
- **SIM7600**: 4.1V, 2A peak current
- **Total**: ~2.3A peak

### Arduino Mega + SIM800L
- **Arduino Mega**: 5V, ~40mA
- **SIM800L**: 4.2V, 2A peak current
- **Total**: ~2.04A peak

### Power Supply Recommendations

1. **Minimum**: 5V, 3A switching power supply
2. **Recommended**: 5V, 5A switching power supply with good regulation
3. **Battery**: 12V lead-acid or 3S LiPo with buck converter

### Power Filtering Components

```
Power Supply ──► [Fuse] ──► [Diode] ──► [1000-2200µF Cap] ──► [Ferrite Bead] ──► Module VCC
                                      │
                                      └─► [100nF Ceramic Cap] ──► GND
```

- **Fuse**: 3A fast-blow fuse for protection
- **Diode**: 1N4007 for reverse polarity protection
- **Capacitor**: 1000-2200µF electrolytic near module power pins
- **Ferrite Bead**: 100Ω @ 100MHz to reduce switching noise

## Safety Considerations

### Electrical Safety
1. **Reverse Polarity Protection**: Always use protection diodes
2. **Overcurrent Protection**: Install appropriate fuses
3. **Ground Loops**: Use single-point grounding
4. **ESD Protection**: Handle modules with anti-static precautions

### Thermal Management
1. **SIM7600/SIM800L**: Can get warm during operation
2. **Heat Sinking**: Consider small heat sinks for extended use
3. **Ventilation**: Ensure adequate airflow in enclosure

### RF Considerations
1. **Antenna Placement**: Keep antennas away from sensitive circuits
2. **Shielding**: Consider RF shielding for sensitive applications
3. **Ground Plane**: Maintain good ground plane for antennas

## Troubleshooting

### Common Issues

#### ESP32 Issues
- **WiFi Connection Failed**: Check SSID/password, signal strength
- **SIM7600 Not Responding**: Check power supply, wiring, AT commands
- **GPS No Fix**: Ensure open sky, check antenna connection

#### Arduino Mega Issues
- **SIM800L Not Responding**: Check voltage divider, power supply
- **HTTP POST Failed**: Verify server connectivity, check AT commands
- **GPS Module Issues**: Check baud rate, wiring connections

#### Power Issues
- **Module Resets**: Insufficient current capacity
- **Voltage Drops**: Add larger capacitors, check wiring resistance
- **Noise Issues**: Add ferrite beads, improve grounding

### Debug Commands

#### SIM7600 AT Commands
```
AT              - Test communication
AT+CPIN?        - Check SIM card
AT+CREG?        - Check network registration
AT+CGNSPWR=1    - Enable GPS
AT+CGNSINF      - Get GPS info
AT+CSQ          - Signal quality
```

#### SIM800L AT Commands
```
AT              - Test communication
AT+CPIN?        - Check SIM card
AT+CREG?        - Check network registration
AT+CGATT=1      - Attach to GPRS
AT+SAPBR=3,1,"APN","internet" - Set APN
AT+SAPBR=1,1    - Open bearer
```

### Testing Procedure

1. **Power On Test**: Verify all modules power up correctly
2. **AT Command Test**: Test basic communication with modules
3. **GPS Test**: Verify GPS fix acquisition
4. **Network Test**: Test cellular connectivity
5. **Data Transmission Test**: Verify end-to-end data flow

### Performance Optimization

1. **Power Management**: Use sleep modes when possible
2. **Data Compression**: Minimize payload size
3. **Connection Pooling**: Reuse connections when possible
4. **Error Handling**: Implement robust retry logic

## Legal Notice

**IMPORTANT**: This GPS tracking system is intended for tracking vehicles and assets that you own or have explicit written consent to track. Always comply with local laws and regulations regarding GPS tracking and privacy. Obtain proper consent before deploying tracking devices on any vehicle or asset.
