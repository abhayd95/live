-- MySQL initialization script for GPS Tracker
-- This script is automatically executed when the MySQL container starts

-- Use the database
USE tracker_gps;

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading DECIMAL(5, 2) DEFAULT 0,
    satellites INT DEFAULT 0,
    source VARCHAR(50) DEFAULT 'unknown',
    timestamp BIGINT NOT NULL,
    received_at BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_id (device_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_received_at (received_at),
    INDEX idx_device_timestamp (device_id, timestamp),
    INDEX idx_source (source)
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    device_type VARCHAR(50) DEFAULT 'unknown',
    last_seen BIGINT,
    total_positions INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_last_seen (last_seen),
    INDEX idx_device_type (device_type)
);

-- Create device_stats table
CREATE TABLE IF NOT EXISTS device_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    total_positions INT DEFAULT 0,
    max_speed DECIMAL(5, 2) DEFAULT 0,
    total_distance DECIMAL(10, 2) DEFAULT 0,
    online_time INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_device_date (device_id, date),
    INDEX idx_device_id (device_id),
    INDEX idx_date (date),
    INDEX idx_device_date (device_id, date)
);

-- Create heartbeats table
CREATE TABLE IF NOT EXISTS heartbeats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    heartbeat_type VARCHAR(50) DEFAULT 'status',
    timestamp BIGINT NOT NULL,
    gps_valid BOOLEAN DEFAULT FALSE,
    network_connected BOOLEAN DEFAULT FALSE,
    battery_level INT,
    signal_strength INT,
    free_memory INT,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_id (device_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_device_timestamp (device_id, timestamp)
);

-- Insert sample devices for testing
INSERT IGNORE INTO devices (device_id, name, description, device_type) VALUES
('test_01', 'Test Vehicle 1', 'Sample vehicle for testing', 'vehicle'),
('test_02', 'Test Asset 1', 'Sample asset for testing', 'asset'),
('sim_001', 'Simulator Device', 'Device simulator for testing', 'simulator');

-- Log initialization
INSERT IGNORE INTO heartbeats (device_id, heartbeat_type, timestamp, data)
VALUES ('system', 'migration', UNIX_TIMESTAMP(NOW()) * 1000, '{"version": "1.0.0", "migration": "mysql_init"}');
