/**
 * PM2 Configuration for GPS Tracker Server
 * Production process management with clustering
 */

module.exports = {
    apps: [{
        name: 'gps-tracker-server',
        script: './server.js',
        instances: 'max', // Use all available CPU cores
        exec_mode: 'cluster',

        // Environment configuration
        env: {
            NODE_ENV: 'development',
            PORT: 3000,
            PUBLIC_ORIGIN: 'http://localhost:3000',
            DB_HOST: 'localhost',
            DB_PORT: 3306,
            DB_NAME: 'tracker_gps',
            DB_USER: 'root',
            DB_PASSWORD: 'abhayd95',
            DB_CONNECTION_LIMIT: 10,
            DEVICE_TOKEN: 'default_token',
            HISTORY_POINTS: 500,
            ONLINE_WINDOW_S: 60,
            POLL_INTERVAL_MS: 5000,
            MQTT_ENABLED: false,
            RATE_LIMIT_WINDOW_MS: 900000,
            RATE_LIMIT_MAX_REQUESTS: 100,
            LOG_LEVEL: 'info'
        },

        // Production environment
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
            PUBLIC_ORIGIN: 'https://your-domain.com',
            DB_HOST: process.env.DB_HOST || 'localhost',
            DB_PORT: parseInt(process.env.DB_PORT) || 3306,
            DB_NAME: process.env.DB_NAME || 'tracker_gps',
            DB_USER: process.env.DB_USER || 'root',
            DB_PASSWORD: process.env.DB_PASSWORD || 'abhayd95',
            DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
            DEVICE_TOKEN: process.env.DEVICE_TOKEN || 'change_this_token',
            HISTORY_POINTS: parseInt(process.env.HISTORY_POINTS) || 500,
            ONLINE_WINDOW_S: parseInt(process.env.ONLINE_WINDOW_S) || 60,
            POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
            MQTT_ENABLED: process.env.MQTT_ENABLED === 'true',
            MQTT_BROKER_HOST: process.env.MQTT_BROKER_HOST || 'localhost',
            MQTT_PORT: parseInt(process.env.MQTT_PORT) || 1883,
            MQTT_USERNAME: process.env.MQTT_USERNAME || '',
            MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
            RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
            RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            LOG_LEVEL: process.env.LOG_LEVEL || 'info'
        },

        // Process management
        autorestart: true,
        watch: false, // Disable in production
        max_memory_restart: '1G',
        min_uptime: '10s',
        max_restarts: 10,

        // Logging
        log_file: './logs/combined.log',
        out_file: './logs/out.log',
        error_file: './logs/error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Advanced options
        kill_timeout: 5000,
        listen_timeout: 3000,
        shutdown_with_message: true,

        // Monitoring
        pmx: true,

        // Health check
        health_check_grace_period: 30000,
        health_check_fatal_exceptions: true,

        // Cluster options
        increment_var: 'PORT',

        // Source map support
        source_map_support: true,

        // Ignore watch patterns
        ignore_watch: [
            'node_modules',
            'logs',
            'data',
            '.git'
        ],

        // Environment-specific settings
        node_args: [
            '--max-old-space-size=1024',
            '--optimize-for-size'
        ],

        // Restart conditions
        restart_delay: 4000,
        exp_backoff_restart_delay: 100,

        // Process title
        title: 'GPS Tracker Server'
    }],

    // Deployment configuration
    deploy: {
        production: {
            user: 'deploy',
            host: ['your-server.com'],
            ref: 'origin/main',
            repo: 'https://github.com/your-org/gps-tracker.git',
            path: '/var/www/gps-tracker',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload pm2.config.cjs --env production',
            'pre-setup': ''
        },

        staging: {
            user: 'deploy',
            host: ['staging-server.com'],
            ref: 'origin/develop',
            repo: 'https://github.com/your-org/gps-tracker.git',
            path: '/var/www/gps-tracker-staging',
            'post-deploy': 'npm install && pm2 reload pm2.config.cjs --env staging',
            env: {
                NODE_ENV: 'staging'
            }
        }
    }
};