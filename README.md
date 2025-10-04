# 🛰️ Real-Time GPS Tracker System

A complete, production-ready GPS tracking system with real-time dashboard, MQTT/HTTP device support, and mobile-first design.

## 🚀 Features

- **Real-time Dashboard**: Live map with moving devices, trails, clustering, and device management
- **Dual Protocol Support**: MQTT (primary) and HTTP (fallback) for maximum compatibility
- **Mobile-First Design**: Responsive dashboard optimized for mobile devices
- **Device Simulator**: Built-in simulator for testing without hardware
- **Production Ready**: Docker, PM2, security, rate limiting, and monitoring
- **PWA Support**: Progressive Web App with offline capabilities

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ESP32 +       │    │   Arduino Mega  │    │   Dashboard     │
│   SIM7600 4G    │    │   + SIM800L 2G  │    │   (WebSocket)   │
│   (MQTT)        │    │   (HTTP)        │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ MQTT                 │ HTTP                 │ WebSocket
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │    Node.js Server       │
                    │  - Express REST API     │
                    │  - WebSocket Server     │
                    │  - MQTT Bridge          │
                    │  - SQLite Database      │
                    └─────────────────────────┘
```

## 📋 Quick Start

### 1. Local Development

```bash
# Setup MySQL database
mysql -u root -p
CREATE DATABASE tracker_gps;
SOURCE db/migrate.sql;
exit

# Clone and setup
cd server
cp env.example .env
npm install
npm run dev

# Open dashboard
open http://localhost:3000

# Run device simulator
node tools/device-simulator.js --n 5 --mode http
```

### 2. Docker Deployment

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f gps-tracker-server

# Stop
docker-compose down
```

### 3. Production with PM2

```bash
# Install PM2
npm install -g pm2

# Start in production
pm2 start pm2.config.cjs --env production

# Monitor
pm2 monit
```

## 🔧 Configuration

### Server Configuration (`.env`)

```env
# Server Settings
PORT=3000
PUBLIC_ORIGIN=http://localhost:3000

# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tracker_gps
DB_USER=root
DB_PASSWORD=abhayd95
DB_CONNECTION_LIMIT=10

# System Settings
HISTORY_POINTS=500
ONLINE_WINDOW_S=60

# Device Authentication
DEVICE_TOKEN=your_secure_token_here

# MQTT (Optional)
MQTT_ENABLED=true
MQTT_BROKER_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=mqtt_user
MQTT_PASSWORD=mqtt_password

# Performance
POLL_INTERVAL_MS=5000
RATE_LIMIT_MAX_REQUESTS=100
```

### Firmware Configuration (`config.h`)

```cpp
// Network Settings
#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASS "your_wifi_password"
#define SERVER_HOST "your_server_ip:3000"

// MQTT Settings (ESP32 only)
#define MQTT_BROKER_HOST "your_mqtt_broker"
#define MQTT_USERNAME "mqtt_user"
#define MQTT_PASSWORD "mqtt_password"

// Device Settings
#define DEVICE_ID "device_001"
#define DEVICE_TOKEN "your_secure_token_here"

// SIM Card Settings
#define APN "internet"  // Update for your carrier
```

## 📱 Dashboard Features

### Map Controls
- **Center All**: Focus on all devices
- **Trails**: Show/hide device movement paths
- **Clusters**: Group nearby devices
- **Fullscreen**: Toggle fullscreen mode

### Device Management
- **Real-time Updates**: Live position updates via WebSocket
- **Device Search**: Filter devices by name
- **Status Indicators**: Online/offline/recent status
- **Click to Focus**: Click device to center map

### System Stats
- **Total Devices**: Count of registered devices
- **Online Devices**: Devices seen in last 60 seconds
- **WebSocket Clients**: Active dashboard connections
- **System Uptime**: Server uptime display

## 🔌 Hardware Setup

### ESP32 + SIM7600 (Primary)

```
ESP32 DevKit V1        SIM7600 4G Module
├── GPIO4  ────────────► UART_TX
├── GPIO5  ────────────► UART_RX
├── GPIO12 ────────────► PWR_PIN
├── 5V     ────────────► VCC (4.1V)
└── GND    ────────────► GND

Power Requirements:
- 4.1V, 2A peak current
- 1000-2200µF capacitor near modem
- Reverse polarity protection
```

### Arduino Mega + SIM800L (Fallback)

```
Arduino Mega 2560      SIM800L 2G Module
├── Digital Pin 10 ────► TX (via voltage divider)
├── Digital Pin 11 ────► RX
├── Digital Pin 12 ────► PWR_PIN
├── 5V ───────────────► VCC (via diode)
└── GND ──────────────► GND

Voltage Divider (TX):
SIM800L TX ──── 10kΩ ──── Arduino Pin 10
                    │
                 20kΩ
                    │
                  GND
```

## 🧪 Testing

### Device Simulator

```bash
# Basic simulation
node tools/device-simulator.js --n 10 --mode http

# MQTT simulation
node tools/device-simulator.js --n 5 --mode mqtt --host localhost:1883

# High-frequency testing
node tools/device-simulator.js --n 3 --interval 1000 --speed 60

# Custom location
node tools/device-simulator.js --n 5 --start-lat 37.7749 --start-lng -122.4194
```

### API Testing

```bash
# Test tracking endpoint
curl -X POST http://localhost:3000/api/track \
  -H "Content-Type: application/json" \
  -H "X-Device-Token: your_token" \
  -d '{
    "device_id": "test_01",
    "lat": 40.7128,
    "lng": -74.0060,
    "speed": 45,
    "heading": 180,
    "sats": 10,
    "timestamp": 1640995200000,
    "src": "test"
  }'

# Check system health
curl http://localhost:3000/api/health

# Get device stats
curl http://localhost:3000/api/stats
```

## 🚀 Deployment

### Docker Deployment

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# With monitoring stack
docker-compose --profile monitoring up -d

# With reverse proxy
docker-compose --profile proxy up -d

# SSL setup (Let's Encrypt)
docker-compose --profile proxy up -d
# Then configure SSL certificates in nginx/ssl/
```

### PM2 Deployment

```bash
# Setup environment
export DEVICE_TOKEN="your_secure_token"
export MQTT_BROKER_HOST="your_mqtt_broker"

# Deploy to production
pm2 deploy production

# Monitor deployment
pm2 logs gps-tracker-server --lines 100
```

### Manual Deployment

```bash
# Install dependencies
npm install --production

# Setup database
mkdir -p data logs

# Configure environment
cp env.example .env
# Edit .env with your settings

# Start with PM2
pm2 start pm2.config.cjs --env production

# Setup systemd service (optional)
sudo pm2 startup
pm2 save
```

## 🔒 Security

### Device Authentication
- Device tokens required for HTTP API
- MQTT username/password authentication
- Rate limiting on API endpoints

### Network Security
- CORS configuration
- Helmet.js security headers
- Input validation and sanitization

### Production Security
- Reverse proxy with SSL termination
- Firewall configuration
- Regular security updates

## 📊 Monitoring

### Health Checks
```bash
# Application health
curl http://localhost:3000/api/health

# Docker health
docker ps --format "table {{.Names}}\t{{.Status}}"

# PM2 status
pm2 status
```

### Logs
```bash
# Application logs
tail -f logs/combined.log

# Docker logs
docker-compose logs -f gps-tracker-server

# PM2 logs
pm2 logs gps-tracker-server
```

### Performance Monitoring
- Prometheus metrics (optional)
- Grafana dashboards (optional)
- PM2 monitoring
- Database performance tracking

## 🛠️ Troubleshooting

### Common Issues

#### WebSocket Connection Failed
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3000/ws
```

#### Device Not Connecting
1. Check device token in firmware config
2. Verify server host/port settings
3. Test network connectivity
4. Check firewall settings

#### GPS No Fix
1. Ensure open sky for GPS antenna
2. Check antenna connections
3. Wait for cold start (up to 30 seconds)
4. Test with external GPS module

#### MQTT Connection Issues
```bash
# Test MQTT broker
mosquitto_pub -h localhost -t "test" -m "hello"
mosquitto_sub -h localhost -t "test"

# Check broker logs
docker-compose logs mosquitto
```

#### Database Issues
```bash
# Check MySQL connection
mysql -u root -p -e "USE tracker_gps; SHOW TABLES;"

# Test database connection
mysql -u root -p -e "USE tracker_gps; SELECT COUNT(*) FROM positions;"

# Check MySQL service
sudo systemctl status mysql

# Restart MySQL service
sudo systemctl restart mysql

# Recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS tracker_gps; CREATE DATABASE tracker_gps;"
SOURCE db/migrate.sql;
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Verbose simulator
node tools/device-simulator.js --n 1 --verbose --mode http
```

### Performance Issues

```bash
# Check memory usage
pm2 monit

# Check database size
du -h data/tracker.sqlite

# Monitor network connections
netstat -an | grep :3000
```

## 📚 API Reference

### REST Endpoints

#### POST /api/track
Submit device position data.

**Headers:**
- `X-Device-Token`: Device authentication token
- `Content-Type`: application/json

**Body:**
```json
{
  "device_id": "device_001",
  "lat": 40.7128,
  "lng": -74.0060,
  "speed": 45.5,
  "heading": 180.0,
  "sats": 10,
  "timestamp": 1640995200000,
  "src": "gps"
}
```

#### GET /api/positions
Get latest positions for all devices.

**Response:**
```json
{
  "positions": [...],
  "timestamp": 1640995200000,
  "count": 5
}
```

#### GET /api/stats
Get system statistics.

**Response:**
```json
{
  "total_devices": 10,
  "online_devices": 8,
  "ws_clients": 3,
  "uptime": 3600000,
  "mqtt_connected": true,
  "timestamp": 1640995200000
}
```

#### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600000,
  "wsClients": 3,
  "devices": 10,
  "mqttConnected": true
}
```

### WebSocket Events

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

#### Message Types

**Init Message:**
```json
{
  "type": "init",
  "positions": [...],
  "timestamp": 1640995200000
}
```

**Position Update:**
```json
{
  "type": "update",
  "device": {
    "device_id": "device_001",
    "lat": 40.7128,
    "lng": -74.0060,
    "speed": 45.5,
    "heading": 180.0,
    "satellites": 10,
    "source": "gps",
    "timestamp": 1640995200000,
    "received_at": 1640995201000
  },
  "timestamp": 1640995201000
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "timestamp": 1640995200000
}
```

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Legal Notice

**IMPORTANT**: This GPS tracking system is intended for tracking vehicles and assets that you own or have explicit written consent to track. Always comply with local laws and regulations regarding GPS tracking and privacy. Obtain proper consent before deploying tracking devices on any vehicle or asset.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation

---

**Built with ❤️ for real-time GPS tracking**
