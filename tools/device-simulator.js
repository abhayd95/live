#!/usr/bin/env node

/*
 * GPS Device Simulator
 * Simulates multiple GPS tracking devices for testing
 * 
 * Usage:
 *   node device-simulator.js --n 10 --interval 1000 --speed 40 --mode mqtt --host localhost
 *   node device-simulator.js --n 5 --mode http --host 192.168.1.100:3000
 */

const mqtt = require('mqtt');
const http = require('http');
const https = require('https');
const readline = require('readline');

class DeviceSimulator {
    constructor(options) {
        this.options = {
            deviceCount: options.n || 5,
            interval: options.interval || 5000,
            speed: options.speed || 30, // km/h
            mode: options.mode || 'http', // 'mqtt' or 'http'
            host: options.host || 'localhost:3000',
            mqttPort: options.mqttPort || 1883,
            mqttUsername: options.mqttUsername || '',
            mqttPassword: options.mqttPassword || '',
            deviceToken: options.token || 'default_token',
            startLat: options.startLat || 40.7128,
            startLng: options.startLng || -74.0060,
            radius: options.radius || 1000, // meters
            verbose: options.verbose || false,
            ...options
        };

        this.devices = new Map();
        this.intervals = new Map();
        this.mqttClient = null;
        this.isRunning = false;

        this.init();
    }

    init() {
        console.log('🚀 GPS Device Simulator Starting...');
        console.log('Configuration:', {
            devices: this.options.deviceCount,
            interval: this.options.interval + 'ms',
            speed: this.options.speed + ' km/h',
            mode: this.options.mode.toUpperCase(),
            host: this.options.host
        });

        // Create simulated devices
        this.createDevices();

        // Setup connection based on mode
        if (this.options.mode === 'mqtt') {
            this.setupMQTT();
        } else {
            this.setupHTTP();
        }

        // Setup graceful shutdown
        this.setupShutdown();

        console.log(`✅ Created ${this.options.deviceCount} simulated devices`);
        console.log('Press Ctrl+C to stop simulation');
    }

    createDevices() {
        for (let i = 1; i <= this.options.deviceCount; i++) {
            const deviceId = `sim_${String(i).padStart(3, '0')}`;

            // Generate random starting position within radius
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * this.options.radius;
            const latOffset = (distance / 111000) * Math.cos(angle); // Rough conversion
            const lngOffset = (distance / (111000 * Math.cos(this.options.startLat * Math.PI / 180))) * Math.sin(angle);

            const device = {
                id: deviceId,
                lat: this.options.startLat + latOffset,
                lng: this.options.startLng + lngOffset,
                heading: Math.random() * 360,
                speed: this.options.speed + (Math.random() - 0.5) * 10, // ±5 km/h variation
                satellites: 8 + Math.floor(Math.random() * 5), // 8-12 satellites
                source: 'simulator',
                isMoving: true,
                lastUpdate: Date.now()
            };

            this.devices.set(deviceId, device);
        }
    }

    setupMQTT() {
        try {
            const mqttUrl = `mqtt://${this.options.host}:${this.options.mqttPort}`;
            const mqttOptions = {
                username: this.options.mqttUsername,
                password: this.options.mqttPassword,
                keepalive: 60,
                reconnectPeriod: 5000,
                connectTimeout: 30000
            };

            this.mqttClient = mqtt.connect(mqttUrl, mqttOptions);

            this.mqttClient.on('connect', () => {
                console.log('✅ MQTT connected to broker');
                this.startSimulation();
            });

            this.mqttClient.on('error', (error) => {
                console.error('❌ MQTT connection error:', error.message);
            });

            this.mqttClient.on('close', () => {
                console.log('⚠️  MQTT connection closed');
            });

            this.mqttClient.on('reconnect', () => {
                console.log('🔄 MQTT reconnecting...');
            });

        } catch (error) {
            console.error('❌ Failed to setup MQTT:', error.message);
            process.exit(1);
        }
    }

    setupHTTP() {
        // Test HTTP connection
        this.testHTTPConnection().then(() => {
            console.log('✅ HTTP connection test successful');
            this.startSimulation();
        }).catch((error) => {
            console.error('❌ HTTP connection test failed:', error.message);
            process.exit(1);
        });
    }

    async testHTTPConnection() {
        return new Promise((resolve, reject) => {
            const url = `http://${this.options.host}/api/health`;

            http.get(url, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            }).on('error', reject);
        });
    }

    startSimulation() {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('🎯 Starting device simulation...');

        // Start each device with slight delay to spread out updates
        this.devices.forEach((device, deviceId) => {
            const delay = Math.random() * 1000; // Random delay up to 1 second

            setTimeout(() => {
                this.startDevice(deviceId);
            }, delay);
        });

        // Start status reporting
        this.startStatusReporting();
    }

    startDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const interval = setInterval(() => {
            this.updateDevice(deviceId);
            this.sendPosition(deviceId);
        }, this.options.interval + Math.random() * 1000); // Add some jitter

        this.intervals.set(deviceId, interval);

        if (this.options.verbose) {
            console.log(`📍 Device ${deviceId} started`);
        }
    }

    updateDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const now = Date.now();
        const deltaTime = (now - device.lastUpdate) / 1000; // seconds
        device.lastUpdate = now;

        // Calculate movement
        if (device.isMoving) {
            const distance = (device.speed * deltaTime) / 3600; // km
            const distanceDegrees = distance / 111; // rough conversion to degrees

            // Update position based on heading
            const latOffset = distanceDegrees * Math.cos(device.heading * Math.PI / 180);
            const lngOffset = distanceDegrees * Math.sin(device.heading * Math.PI / 180) / Math.cos(device.lat * Math.PI / 180);

            device.lat += latOffset;
            device.lng += lngOffset;

            // Add some randomness to movement
            device.heading += (Math.random() - 0.5) * 10; // ±5 degree variation
            if (device.heading < 0) device.heading += 360;
            if (device.heading >= 360) device.heading -= 360;

            // Occasionally change direction or stop
            if (Math.random() < 0.05) { // 5% chance
                if (Math.random() < 0.7) {
                    device.heading = Math.random() * 360; // Change direction
                } else {
                    device.isMoving = !device.isMoving; // Start/stop moving
                }
            }

            // Update speed with some variation
            device.speed = this.options.speed + (Math.random() - 0.5) * 10;
            device.speed = Math.max(0, device.speed); // Don't go negative
        }

        // Update satellite count with some variation
        device.satellites = 8 + Math.floor(Math.random() * 5);
    }

    sendPosition(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const payload = {
            device_id: deviceId,
            lat: device.lat,
            lng: device.lng,
            speed: device.speed,
            heading: device.heading,
            sats: device.satellites,
            ts: Date.now(),
            src: device.source
        };

        if (this.options.mode === 'mqtt') {
            this.sendMQTT(deviceId, payload);
        } else {
            this.sendHTTP(payload);
        }
    }

    sendMQTT(deviceId, payload) {
        if (!this.mqttClient || !this.mqttClient.connected) {
            if (this.options.verbose) {
                console.log(`⚠️  MQTT not connected, skipping ${deviceId}`);
            }
            return;
        }

        const topic = `track/${deviceId}`;
        const message = JSON.stringify(payload);

        this.mqttClient.publish(topic, message, (error) => {
            if (error) {
                console.error(`❌ MQTT publish error for ${deviceId}:`, error.message);
            } else if (this.options.verbose) {
                console.log(`📡 MQTT: ${deviceId} -> ${device.lat.toFixed(6)}, ${device.lng.toFixed(6)}`);
            }
        });
    }

    sendHTTP(payload) {
        const postData = JSON.stringify(payload);

        const options = {
            hostname: this.options.host.split(':')[0],
            port: this.options.host.split(':')[1] || 3000,
            path: '/api/track',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Device-Token': this.options.deviceToken
            }
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                if (this.options.verbose) {
                    const device = this.devices.get(payload.device_id);
                    console.log(`📡 HTTP: ${payload.device_id} -> ${device.lat.toFixed(6)}, ${device.lng.toFixed(6)}`);
                }
            } else {
                console.error(`❌ HTTP error for ${payload.device_id}: ${res.statusCode} ${res.statusMessage}`);
            }
        });

        req.on('error', (error) => {
            console.error(`❌ HTTP request error for ${payload.device_id}:`, error.message);
        });

        req.write(postData);
        req.end();
    }

    startStatusReporting() {
        setInterval(() => {
            const activeDevices = Array.from(this.devices.values()).filter(d => d.isMoving).length;
            const totalUpdates = Array.from(this.devices.values()).reduce((sum, d) => sum + d.lastUpdate, 0);

            console.log(`📊 Status: ${this.devices.size} devices, ${activeDevices} moving, mode: ${this.options.mode.toUpperCase()}`);
        }, 10000); // Every 10 seconds
    }

    stopSimulation() {
        if (!this.isRunning) return;

        console.log('\n🛑 Stopping simulation...');

        this.isRunning = false;

        // Clear all intervals
        this.intervals.forEach((interval) => {
            clearInterval(interval);
        });
        this.intervals.clear();

        // Close MQTT connection
        if (this.mqttClient) {
            this.mqttClient.end();
        }

        console.log('✅ Simulation stopped');
    }

    setupShutdown() {
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            this.stopSimulation();
            process.exit(0);
        });

        // Handle termination signals
        process.on('SIGTERM', () => {
            this.stopSimulation();
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught exception:', error.message);
            this.stopSimulation();
            process.exit(1);
        });

        process.on('unhandledRejection', (reason) => {
            console.error('❌ Unhandled rejection:', reason);
            this.stopSimulation();
            process.exit(1);
        });
    }
}

// Command line argument parsing
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--n':
            case '--devices':
                options.n = parseInt(args[++i]);
                break;
            case '--interval':
                options.interval = parseInt(args[++i]);
                break;
            case '--speed':
                options.speed = parseFloat(args[++i]);
                break;
            case '--mode':
                options.mode = args[++i];
                break;
            case '--host':
                options.host = args[++i];
                break;
            case '--mqtt-port':
                options.mqttPort = parseInt(args[++i]);
                break;
            case '--mqtt-username':
                options.mqttUsername = args[++i];
                break;
            case '--mqtt-password':
                options.mqttPassword = args[++i];
                break;
            case '--token':
                options.token = args[++i];
                break;
            case '--start-lat':
                options.startLat = parseFloat(args[++i]);
                break;
            case '--start-lng':
                options.startLng = parseFloat(args[++i]);
                break;
            case '--radius':
                options.radius = parseFloat(args[++i]);
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('--')) {
                    console.error(`❌ Unknown option: ${arg}`);
                    process.exit(1);
                }
        }
    }

    return options;
}

function showHelp() {
    console.log(`
🚀 GPS Device Simulator

Usage: node device-simulator.js [options]

Options:
  --n, --devices <number>     Number of devices to simulate (default: 5)
  --interval <ms>             Update interval in milliseconds (default: 5000)
  --speed <kmh>               Average speed in km/h (default: 30)
  --mode <mode>               Communication mode: 'mqtt' or 'http' (default: http)
  --host <host>               Server host:port (default: localhost:3000)
  --mqtt-port <port>          MQTT broker port (default: 1883)
  --mqtt-username <user>      MQTT username
  --mqtt-password <pass>      MQTT password
  --token <token>             Device authentication token (default: default_token)
  --start-lat <lat>           Starting latitude (default: 40.7128)
  --start-lng <lng>           Starting longitude (default: -74.0060)
  --radius <meters>           Starting position radius in meters (default: 1000)
  --verbose, -v               Enable verbose logging
  --help, -h                  Show this help message

Examples:
  # Simulate 10 devices via HTTP
  node device-simulator.js --n 10 --mode http --host localhost:3000

  # Simulate 5 devices via MQTT
  node device-simulator.js --n 5 --mode mqtt --host localhost:1883

  # High-frequency simulation with custom location
  node device-simulator.js --n 3 --interval 1000 --speed 60 --start-lat 37.7749 --start-lng -122.4194

  # Verbose mode for debugging
  node device-simulator.js --n 2 --verbose --mode http --host 192.168.1.100:3000
`);
}

// Main execution
if (require.main === module) {
    try {
        const options = parseArgs();
        new DeviceSimulator(options);
    } catch (error) {
        console.error('❌ Failed to start simulator:', error.message);
        process.exit(1);
    }
}

module.exports = DeviceSimulator;