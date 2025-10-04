-- GPS Tracker Database Migration Script for MySQL
-- This script sets up the initial database schema for the GPS tracking system
-- Run this script on your MySQL server to create the required database and tables

-- =============================================================================
-- CREATE DATABASE
-- =============================================================================
CREATE DATABASE IF NOT EXISTS tracker_gps;
USE tracker_gps;

-- =============================================================================
-- POSITIONS TABLE
-- =============================================================================
-- Stores GPS position data from tracking devices
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

-- =============================================================================
-- DEVICES TABLE
-- =============================================================================
-- Stores device information and metadata
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

-- =============================================================================
-- DEVICE_STATS TABLE
-- =============================================================================
-- Stores aggregated statistics for devices
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

-- =============================================================================
-- HEARTBEATS TABLE
-- =============================================================================
-- Stores device heartbeat and status information
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
    data JSON, -- JSON data for additional info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_id (device_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_device_timestamp (device_id, timestamp)
);

-- =============================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Additional indexes for positions table
-- Note: This index may already exist from the table creation above

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Latest position for each device
CREATE VIEW IF NOT EXISTS latest_positions AS
SELECT 
    p.device_id,
    d.name,
    d.description,
    d.device_type,
    p.lat,
    p.lng,
    p.speed,
    p.heading,
    p.satellites,
    p.source,
    p.timestamp,
    p.received_at,
    CASE 
        WHEN (UNIX_TIMESTAMP(NOW()) * 1000 - p.received_at) <= 60000 THEN 'online'
        WHEN (UNIX_TIMESTAMP(NOW()) * 1000 - p.received_at) <= 300000 THEN 'recent'
        ELSE 'offline'
    END as status
FROM positions p
LEFT JOIN devices d ON p.device_id = d.device_id
WHERE p.id IN (
    SELECT MAX(id) 
    FROM positions 
    GROUP BY device_id
);

-- Device summary statistics
CREATE VIEW IF NOT EXISTS device_summary AS
SELECT 
    d.device_id,
    d.name,
    d.description,
    d.device_type,
    d.last_seen,
    d.total_positions,
    lp.lat,
    lp.lng,
    lp.speed,
    lp.heading,
    lp.satellites,
    lp.source,
    lp.status,
    CASE 
        WHEN d.last_seen IS NULL THEN 0
        ELSE (UNIX_TIMESTAMP(NOW()) * 1000 - d.last_seen)
    END as time_since_last_seen
FROM devices d
LEFT JOIN latest_positions lp ON d.device_id = lp.device_id;

-- =============================================================================
-- TRIGGERS FOR DATA INTEGRITY
-- =============================================================================

-- Update device last_seen when position is inserted
DELIMITER $$
CREATE TRIGGER update_device_last_seen
AFTER INSERT ON positions
FOR EACH ROW
BEGIN
    UPDATE devices 
    SET 
        last_seen = NEW.received_at,
        total_positions = total_positions + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE device_id = NEW.device_id;
    
    -- Insert device if it doesn't exist
    INSERT IGNORE INTO devices (device_id, last_seen, total_positions)
    VALUES (NEW.device_id, NEW.received_at, 1);
END$$
DELIMITER ;

-- Update device stats when position is inserted
DELIMITER $$
CREATE TRIGGER update_device_stats
AFTER INSERT ON positions
FOR EACH ROW
BEGIN
    INSERT INTO device_stats (
        device_id, 
        date, 
        total_positions, 
        max_speed
    )
    SELECT 
        NEW.device_id,
        CURDATE(),
        COUNT(*),
        MAX(speed)
    FROM positions 
    WHERE device_id = NEW.device_id 
    AND DATE(FROM_UNIXTIME(timestamp/1000)) = CURDATE()
    ON DUPLICATE KEY UPDATE
        total_positions = VALUES(total_positions),
        max_speed = GREATEST(max_speed, VALUES(max_speed));
END$$
DELIMITER ;

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Insert sample devices for testing
INSERT IGNORE INTO devices (device_id, name, description, device_type) VALUES
('test_01', 'Test Vehicle 1', 'Sample vehicle for testing', 'vehicle'),
('test_02', 'Test Asset 1', 'Sample asset for testing', 'asset'),
('sim_001', 'Simulator Device', 'Device simulator for testing', 'simulator');

-- =============================================================================
-- CLEANUP PROCEDURES
-- =============================================================================

-- Function to clean up old positions (called by application)
-- DELETE FROM positions WHERE received_at < (strftime('%s', 'now') * 1000 - ?);

-- Function to clean up old heartbeats (called by application)
-- DELETE FROM heartbeats WHERE timestamp < (strftime('%s', 'now') * 1000 - ?);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log migration completion
INSERT IGNORE INTO heartbeats (device_id, heartbeat_type, timestamp, data)
VALUES ('system', 'migration', UNIX_TIMESTAMP(NOW()) * 1000, '{"version": "1.0.0", "migration": "initial_schema"}');
