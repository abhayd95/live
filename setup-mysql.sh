#!/bin/bash

# GPS Tracker MySQL Setup Script
# This script helps set up the MySQL database for the GPS tracking system

echo "🚀 GPS Tracker MySQL Setup"
echo "=========================="

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed. Please install MySQL first:"
    echo "   Ubuntu/Debian: sudo apt-get install mysql-server"
    echo "   macOS: brew install mysql"
    echo "   CentOS/RHEL: sudo yum install mysql-server"
    exit 1
fi

# Check if MySQL service is running
if ! systemctl is-active --quiet mysql 2>/dev/null && ! pgrep -x mysqld > /dev/null; then
    echo "⚠️  MySQL service is not running. Starting MySQL..."
    sudo systemctl start mysql 2>/dev/null || sudo service mysql start 2>/dev/null || {
        echo "❌ Failed to start MySQL service. Please start it manually."
        exit 1
    }
fi

# Get MySQL root password
echo "🔐 Please enter MySQL root password (default: abhayd95):"
read -s -p "Password: " MYSQL_PASSWORD
MYSQL_PASSWORD=${MYSQL_PASSWORD:-abhayd95}

# Test MySQL connection
echo "🔍 Testing MySQL connection..."
mysql -u root -p"$MYSQL_PASSWORD" -e "SELECT 1;" 2>/dev/null || {
    echo "❌ Failed to connect to MySQL. Please check your password and MySQL service."
    exit 1
}

echo "✅ MySQL connection successful!"

# Create database
echo "📊 Creating database 'tracker_gps'..."
mysql -u root -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS tracker_gps;" || {
    echo "❌ Failed to create database."
    exit 1
}

# Run migration script
echo "🔧 Running database migration..."
mysql -u root -p"$MYSQL_PASSWORD" tracker_gps < db/migrate.sql || {
    echo "❌ Failed to run migration script."
    exit 1
}

echo "✅ Database setup complete!"

# Update environment file
echo "⚙️  Updating environment configuration..."
if [ -f "server/.env" ]; then
    echo "⚠️  .env file already exists. Please update it manually with:"
    echo "   DB_HOST=localhost"
    echo "   DB_PORT=3306"
    echo "   DB_NAME=tracker_gps"
    echo "   DB_USER=root"
    echo "   DB_PASSWORD=$MYSQL_PASSWORD"
else
    cp server/env.example server/.env
    echo "✅ Created .env file from template"
fi

echo ""
echo "🎉 MySQL setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. cd server"
echo "2. npm install"
echo "3. npm run dev"
echo ""
echo "Your GPS tracker is ready to use!"
