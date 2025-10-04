/*
 * GPS Tracker Server
 * Real-time GPS tracking with WebSocket and MQTT support
 * 
 * Features:
 * - Express REST API for device data
 * - WebSocket for real-time updates
 * - MQTT bridge for IoT devices
 * - SQLite persistence
 * - Security and rate limiting
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mqtt = require('mqtt');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Configuration
const config = {
    port: process.env.PORT || 3000,
    publicOrigin: process.env.PUBLIC_ORIGIN || 'http://localhost:3000',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT) || 3306,
    dbName: process.env.DB_NAME || 'tracker_gps',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || 'abhayd95',
    dbConnectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    deviceToken: process.env.DEVICE_TOKEN || 'test_token_123',
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-this-in-production',
    historyPoints: parseInt(process.env.HISTORY_POINTS) || 500,
    onlineWindowS: parseInt(process.env.ONLINE_WINDOW_S) || 60,
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
    mqttEnabled: process.env.MQTT_ENABLED === 'true',
    mqttBrokerHost: process.env.MQTT_BROKER_HOST || 'localhost',
    mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
    mqttUsername: process.env.MQTT_USERNAME || '',
    mqttPassword: process.env.MQTT_PASSWORD || '',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Much higher for development
    logLevel: process.env.LOG_LEVEL || 'info'
};

// Global state
let db;
let wss;
let mqttClient;

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, config.jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Check if user is authenticated (for protected routes)
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};
const devicePositions = new Map(); // device_id -> latest position
const wsClients = new Set();
let serverStartTime = Date.now();

// Express app setup
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: config.publicOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token']
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: 'Too many requests from this device, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Authentication routes
// User registration
app.post('/api/auth/register', [
    body('username').isLength({ min: 3, max: 50 }).trim().escape().matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    body('full_name').optional().isLength({ max: 100 }).trim().escape()
], async(req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors.array().map(err => ({
                    field: err.path,
                    message: err.msg,
                    value: err.value
                }))
            });
        }

        const { username, email, password, full_name } = req.body;

        console.log(`Registration attempt for username: ${username}, email: ${email}`);

        // Check if user already exists
        const [existingUsers] = await db.execute(
            'SELECT id, username, email FROM users WHERE username = ? OR email = ?', [username, email]
        );

        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            const conflictField = existingUser.username === username ? 'username' : 'email';
            console.log(`Registration failed - ${conflictField} already exists: ${existingUser[conflictField]}`);
            return res.status(409).json({ 
                error: `${conflictField === 'username' ? 'Username' : 'Email'} already exists`,
                field: conflictField
            });
        }

        // Hash password with higher salt rounds for better security
        const passwordHash = await bcrypt.hash(password, 12);
        console.log(`Password hashed successfully for user: ${username}`);

        // Create user with default role
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)', 
            [username, email, passwordHash, full_name || null, 'user', true]
        );

        console.log(`User created successfully: ID ${result.insertId}, Username: ${username}`);

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: result.insertId,
                username,
                email,
                full_name: full_name || null,
                role: 'user'
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to create user account'
        });
    }
});

// User login
app.post('/api/auth/login', [
    body('username').trim().escape(),
    body('password').notEmpty()
], async(req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { username, password } = req.body;

        // Find user by username or email
        const [users] = await db.execute(
            'SELECT id, username, email, password_hash, full_name, role, is_active FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE', [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await db.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]
        );

        // Generate JWT token
        const token = jwt.sign({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            config.jwtSecret, { expiresIn: config.jwtExpiresIn }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
app.get('/api/auth/profile', authenticateToken, async(req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, username, email, full_name, role, last_login, created_at FROM users WHERE id = ?', [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout with session invalidation
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            // Add token to blacklist (in production, use Redis or database)
            // For now, we'll just log the logout
            console.log(`User ${req.user.username} logged out at ${new Date().toISOString()}`);
            
            // In a production environment, you would:
            // 1. Store the token in a blacklist (Redis recommended)
            // 2. Set token expiration to current time
            // 3. Remove from active sessions table
            
            // Update last logout time in database
            await db.execute(
                'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                [req.user.id]
            );
        }
        
        res.json({ 
            message: 'Logout successful',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - serverStartTime,
        wsClients: wsClients.size,
        devices: devicePositions.size,
        mqttConnected: mqttClient ? mqttClient.connected : false
    });
});

// Device tracking endpoint
app.post('/api/track', apiLimiter, async(req, res) => {
    try {
        const { device_id, lat, lng, speed, heading, sats, ts, src } = req.body;
        const deviceToken = req.headers['x-device-token'];

        // Validate device token
        if (deviceToken !== config.deviceToken) {
            return res.status(401).json({ error: 'Invalid device token' });
        }

        // Validate required fields
        if (!device_id || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Missing required fields: device_id, lat, lng' });
        }

        // Validate coordinates
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const timestamp = ts || Date.now();
        const position = {
            device_id,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            speed: parseFloat(speed) || 0,
            heading: parseFloat(heading) || 0,
            satellites: parseInt(sats) || 0,
            source: src || 'http',
            timestamp,
            received_at: Date.now()
        };

        // Update in-memory state
        devicePositions.set(device_id, position);

        // Save to database
        await savePosition(position);

        // Broadcast to WebSocket clients
        broadcastUpdate(position);

        console.log(`Position update from ${device_id}: ${lat}, ${lng}`);

        res.json({
            status: 'success',
            device_id,
            timestamp: position.received_at
        });

    } catch (error) {
        console.error('Error processing tracking data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get latest positions
app.get('/api/positions', (req, res) => {
    try {
        const positions = Array.from(devicePositions.values());
        res.json({
            positions,
            timestamp: Date.now(),
            count: positions.length
        });
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get device statistics
app.get('/api/stats', (req, res) => {
    try {
        const now = Date.now();
        const onlineThreshold = config.onlineWindowS * 1000;

        const positions = Array.from(devicePositions.values());
        const onlineDevices = positions.filter(pos =>
            (now - pos.received_at) <= onlineThreshold
        );

        const stats = {
            total_devices: positions.length,
            online_devices: onlineDevices.length,
            ws_clients: wsClients.size,
            uptime: Date.now() - serverStartTime,
            mqtt_connected: mqttClient ? mqttClient.connected : false,
            timestamp: now
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get device history
app.get('/api/history/:device_id', async(req, res) => {
    try {
        const { device_id } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        try {
            const [rows] = await db.execute(
                'SELECT * FROM positions WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?', [device_id, limit]
            );

            res.json({
                device_id,
                positions: rows,
                count: rows.length,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({ error: 'Database error' });
        }
    } catch (error) {
        console.error('Error fetching device history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// WebSocket server
function setupWebSocket() {
    wss = new WebSocket.Server({
        server,
        path: '/ws'
    });

    wss.on('connection', (ws, req) => {
        const clientId = req.headers['sec-websocket-key'];
        wsClients.add(ws);

        console.log(`WebSocket client connected: ${clientId} (${wsClients.size} total)`);

        // Send initial positions
        const positions = Array.from(devicePositions.values());
        ws.send(JSON.stringify({
            type: 'init',
            positions,
            timestamp: Date.now()
        }));

        // Handle client messages
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Message from client ${clientId}:`, data);

                // Handle different message types
                switch (data.type) {
                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                        break;
                    case 'request_positions':
                        ws.send(JSON.stringify({
                            type: 'positions',
                            positions: Array.from(devicePositions.values()),
                            timestamp: Date.now()
                        }));
                        break;
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });

        // Handle client disconnect
        ws.on('close', () => {
            wsClients.delete(ws);
            console.log(`WebSocket client disconnected: ${clientId} (${wsClients.size} total)`);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
            wsClients.delete(ws);
        });
    });

    // Heartbeat to keep connections alive
    setInterval(() => {
        wsClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'heartbeat',
                    timestamp: Date.now()
                }));
            }
        });
    }, 30000); // Every 30 seconds
}

// MQTT client setup
function setupMQTT() {
    if (!config.mqttEnabled) {
        console.log('MQTT disabled in configuration');
        return;
    }

    const mqttOptions = {
        host: config.mqttBrokerHost,
        port: config.mqttPort,
        username: config.mqttUsername,
        password: config.mqttPassword,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30000
    };

    mqttClient = mqtt.connect(mqttOptions);

    mqttClient.on('connect', () => {
        console.log('MQTT client connected to broker');

        // Subscribe to tracking topics
        mqttClient.subscribe('track/#', (err) => {
            if (err) {
                console.error('MQTT subscription error:', err);
            } else {
                console.log('Subscribed to track/# topics');
            }
        });
    });

    mqttClient.on('message', async(topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`MQTT message from ${topic}:`, data);

            // Process tracking data from MQTT
            if (topic.startsWith('track/')) {
                const device_id = topic.split('/')[1];
                const position = {
                    device_id,
                    lat: parseFloat(data.lat),
                    lng: parseFloat(data.lng),
                    speed: parseFloat(data.speed) || 0,
                    heading: parseFloat(data.heading) || 0,
                    satellites: parseInt(data.sats) || 0,
                    source: data.src || 'mqtt',
                    timestamp: data.ts || Date.now(),
                    received_at: Date.now()
                };

                // Update in-memory state
                devicePositions.set(device_id, position);

                // Save to database
                await savePosition(position);

                // Broadcast to WebSocket clients
                broadcastUpdate(position);
            }
        } catch (error) {
            console.error('Error processing MQTT message:', error);
        }
    });

    mqttClient.on('error', (error) => {
        console.error('MQTT client error:', error);
    });

    mqttClient.on('close', () => {
        console.log('MQTT client disconnected');
    });

    mqttClient.on('reconnect', () => {
        console.log('MQTT client reconnecting...');
    });
}

// Database setup
async function setupDatabase() {
    try {
        // Create MySQL connection pool
        db = mysql.createPool({
            host: config.dbHost,
            port: config.dbPort,
            user: config.dbUser,
            password: config.dbPassword,
            database: config.dbName,
            connectionLimit: config.dbConnectionLimit,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true,
            charset: 'utf8mb4'
        });

        // Test connection
        const connection = await db.getConnection();
        console.log('Connected to MySQL database');
        connection.release();

        // Initialize database schema
        await initializeDatabase();

    } catch (error) {
        console.error('Error connecting to MySQL database:', error);
        process.exit(1);
    }
}

async function initializeDatabase() {
    try {
        // Read and execute migration SQL
        const fs = require('fs');
        const migrationSQL = fs.readFileSync(path.join(__dirname, '../db/migrate.sql'), 'utf8');

        // Split by delimiter and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.includes('DELIMITER')) continue; // Skip delimiter statements

            try {
                await db.execute(statement);
            } catch (error) {
                // Ignore "table already exists" errors
                if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
                    console.warn('Migration warning:', error.message);
                }
            }
        }

        console.log('Database schema initialized');

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

async function savePosition(position) {
    try {
        const query = `
            INSERT INTO positions (device_id, lat, lng, speed, heading, satellites, source, timestamp, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.execute(query, [
            position.device_id,
            position.lat,
            position.lng,
            position.speed,
            position.heading,
            position.satellites,
            position.source,
            position.timestamp,
            position.received_at
        ]);

        // Prune old positions to maintain history limit (temporarily disabled)
        // await prunePositions(position.device_id);

    } catch (error) {
        console.error('Error saving position:', error);
    }
}

async function prunePositions(device_id) {
    try {
        // Get the IDs to keep (most recent positions)
        const keepQuery = `
            SELECT id FROM positions 
            WHERE device_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;

        const [keepRows] = await db.execute(keepQuery, [device_id, parseInt(config.historyPoints)]);
        const keepIds = keepRows.map(row => row.id);

        if (keepIds.length === 0) return;

        // Delete positions not in the keep list
        const placeholders = keepIds.map(() => '?').join(',');
        const deleteQuery = `
            DELETE FROM positions 
            WHERE device_id = ? AND id NOT IN (${placeholders})
        `;

        await db.execute(deleteQuery, [device_id, ...keepIds]);

    } catch (error) {
        console.error('Error pruning positions:', error);
    }
}

function broadcastUpdate(position) {
    const message = JSON.stringify({
        type: 'update',
        device: position,
        timestamp: Date.now()
    });

    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// Cleanup function
async function cleanup() {
    console.log('Shutting down server...');

    if (mqttClient) {
        mqttClient.end();
    }

    if (db) {
        await db.end();
    }

    if (wss) {
        wss.close();
    }

    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
async function startServer() {
    try {
        console.log('Starting GPS Tracker Server...');
        console.log('Configuration:', {
            port: config.port,
            publicOrigin: config.publicOrigin,
            mqttEnabled: config.mqttEnabled,
            historyPoints: config.historyPoints,
            onlineWindowS: config.onlineWindowS
        });

        // Setup database
        await setupDatabase();

        // Setup WebSocket
        setupWebSocket();

        // Setup MQTT (if enabled)
        setupMQTT();

        // Start HTTP server
        server.listen(config.port, () => {
            console.log(`Server running on port ${config.port}`);
            console.log(`WebSocket available at ws://localhost:${config.port}/ws`);
            console.log(`API available at http://localhost:${config.port}/api`);
            console.log(`Dashboard available at ${config.publicOrigin}`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();