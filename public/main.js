/*
 * GPS Tracker Dashboard - Main Application
 * Real-time GPS tracking with WebSocket updates
 */

class GPSTrackerDashboard {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.trails = new Map();
        this.clusterGroup = null;
        this.trailsLayer = null;
        this.ws = null;
        this.wsReconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pollingInterval = null;
        this.isTrailsEnabled = false;
        this.isClustersEnabled = false;
        this.devices = new Map();

        // Configuration from server
        this.config = {
            historyPoints: 500,
            onlineWindowS: 60,
            pollIntervalMs: 5000
        };

        this.init();
    }

    async init() {
        console.log('Initializing GPS Tracker Dashboard...');

        // Initialize map
        this.initMap();

        // Setup event listeners
        this.setupEventListeners();

        // Setup mobile navigation
        this.setupMobileNavigation();

        // Load initial data
        await this.loadInitialData();

        // Connect to WebSocket
        this.connectWebSocket();

        // Start polling as fallback
        this.startPolling();

        console.log('Dashboard initialized successfully');
    }

    initMap() {
        console.log('Initializing map...');

        // Detect if device supports touch
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Initialize Leaflet map with touch optimizations
        this.map = L.map('map', {
            center: [39.8283, -98.5795], // Center of USA
            zoom: 4,
            zoomControl: true,
            attributionControl: true,
            // Touch optimizations
            tap: !isTouchDevice, // Disable tap delay on touch devices
            touchZoom: isTouchDevice,
            doubleClickZoom: !isTouchDevice, // Disable double-click zoom on touch
            scrollWheelZoom: !isTouchDevice, // Disable scroll wheel zoom on touch
            dragging: true,
            // Performance optimizations
            preferCanvas: true,
            zoomSnap: 0.5,
            zoomDelta: 0.5
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Initialize marker cluster group
        this.clusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="cluster-marker">${count}</div>`,
                    className: 'custom-cluster',
                    iconSize: [40, 40]
                });
            }
        });

        // Initialize trails layer
        this.trailsLayer = L.layerGroup().addTo(this.map);

        console.log('Map initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Center All button
        document.getElementById('centerAllBtn').addEventListener('click', () => {
            this.centerAllDevices();
        });

        // Trails toggle button
        document.getElementById('trailsBtn').addEventListener('click', () => {
            this.toggleTrails();
        });

        // Clusters toggle button
        document.getElementById('clustersBtn').addEventListener('click', () => {
            this.toggleClusters();
        });

        // Fullscreen button
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Device search
        document.getElementById('deviceSearch').addEventListener('input', (e) => {
            this.filterDevices(e.target.value);
        });

        // Refresh stats button
        document.getElementById('refreshStatsBtn').addEventListener('click', () => {
            this.refreshStats();
        });

        // Handle fullscreen change
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => this.map.invalidateSize(), 100);
        });

        console.log('Event listeners set up');
    }

    setupMobileNavigation() {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');
        let isSidebarVisible = false;

        if (mobileMenuToggle && sidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                isSidebarVisible = !isSidebarVisible;
                
                if (isSidebarVisible) {
                    sidebar.classList.remove('hidden');
                    mobileMenuToggle.setAttribute('aria-expanded', 'true');
                } else {
                    sidebar.classList.add('hidden');
                    mobileMenuToggle.setAttribute('aria-expanded', 'false');
                }
            });

            // Close sidebar when clicking on device items on mobile
            const deviceList = document.getElementById('deviceList');
            if (deviceList) {
                deviceList.addEventListener('click', (e) => {
                    const deviceItem = e.target.closest('.device-item');
                    if (deviceItem && window.innerWidth <= 768) {
                        setTimeout(() => {
                            sidebar.classList.add('hidden');
                            mobileMenuToggle.setAttribute('aria-expanded', 'false');
                            isSidebarVisible = false;
                        }, 300);
                    }
                });
            }

            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && isSidebarVisible) {
                    if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                        sidebar.classList.add('hidden');
                        mobileMenuToggle.setAttribute('aria-expanded', 'false');
                        isSidebarVisible = false;
                    }
                }
            });

            // Handle orientation change
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.handleResize();
                    if (window.innerWidth > 768) {
                        sidebar.classList.remove('hidden');
                        isSidebarVisible = false;
                    }
                }, 100);
            });
        }
    }

    async loadInitialData() {
        try {
            console.log('Loading initial data...');

            const response = await fetch('/api/positions');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Loaded ${data.positions.length} positions`);

            // Process positions
            data.positions.forEach(position => {
                this.updateDevice(position);
            });

            // Update stats
            await this.updateStats();

            console.log('Initial data loaded successfully');
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showConnectionError('Failed to load initial data');
        }
    }

    connectWebSocket() {
        try {
            console.log('Connecting to WebSocket...');

            // Derive WebSocket URL from current location
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${location.host}/ws`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
                this.wsReconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'init':
                console.log('Received initial data from WebSocket');
                data.positions.forEach(position => {
                    this.updateDevice(position);
                });
                break;

            case 'update':
                console.log('Received position update:', data.device);
                this.updateDevice(data.device);
                break;

            case 'heartbeat':
                // Handle heartbeat if needed
                break;

            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    updateDevice(position) {
        const deviceId = position.device_id;

        // Store device data
        this.devices.set(deviceId, {
            ...position,
            lastUpdate: Date.now()
        });

        // Update or create marker
        this.updateMarker(position);

        // Update trails if enabled
        if (this.isTrailsEnabled) {
            this.updateTrail(deviceId, position);
        }

        // Update device list
        this.updateDeviceList();
    }

    updateMarker(position) {
        const deviceId = position.device_id;
        const lat = position.lat;
        const lng = position.lng;

        // Create custom icon based on status
        const isOnline = this.isDeviceOnline(position);
        const icon = this.createDeviceIcon(deviceId, isOnline, position.source);

        // Remove existing marker
        if (this.markers.has(deviceId)) {
            const existingMarker = this.markers.get(deviceId);
            if (this.clusterGroup.hasLayer(existingMarker)) {
                this.clusterGroup.removeLayer(existingMarker);
            }
            if (this.map.hasLayer(existingMarker)) {
                this.map.removeLayer(existingMarker);
            }
        }

        // Create new marker
        const marker = L.marker([lat, lng], { icon })
            .bindPopup(this.createPopupContent(position));

        // Add to appropriate layer
        if (this.isClustersEnabled) {
            this.clusterGroup.addLayer(marker);
        } else {
            marker.addTo(this.map);
        }

        this.markers.set(deviceId, marker);
    }

    createDeviceIcon(deviceId, isOnline, source) {
        const color = isOnline ? '#10b981' : '#6b7280';
        const size = 32;

        return L.divIcon({
            html: `
                <div class="device-marker ${isOnline ? 'online' : 'offline'}" 
                     style="background-color: ${color}; width: ${size}px; height: ${size}px;">
                    <svg viewBox="0 0 24 24" fill="white" style="width: 16px; height: 16px;">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
            `,
            className: 'custom-device-marker',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    }

    createPopupContent(position) {
        const lastSeen = this.formatLastSeen(position.received_at);
        const speed = position.speed ? `${position.speed.toFixed(1)} km/h` : 'N/A';
        const heading = position.heading ? `${position.heading.toFixed(0)}°` : 'N/A';
        const satellites = position.satellites || 0;

        return `
            <div class="popup-content">
                <h3>${position.device_id}</h3>
                <div class="popup-details">
                    <div><strong>Position:</strong> ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}</div>
                    <div><strong>Speed:</strong> ${speed}</div>
                    <div><strong>Heading:</strong> ${heading}</div>
                    <div><strong>Satellites:</strong> ${satellites}</div>
                    <div><strong>Source:</strong> ${position.source}</div>
                    <div><strong>Last Seen:</strong> ${lastSeen}</div>
                </div>
            </div>
        `;
    }

    updateTrail(deviceId, position) {
        if (!this.trails.has(deviceId)) {
            this.trails.set(deviceId, []);
        }

        const trail = this.trails.get(deviceId);
        trail.push([position.lat, position.lng]);

        // Limit trail length
        if (trail.length > this.config.historyPoints) {
            trail.shift();
        }

        // Update polyline
        this.updateTrailPolyline(deviceId, trail);
    }

    updateTrailPolyline(deviceId, trail) {
        // Remove existing polyline
        const existingPolyline = this.trailsLayer.getLayers().find(layer =>
            layer.options.deviceId === deviceId
        );

        if (existingPolyline) {
            this.trailsLayer.removeLayer(existingPolyline);
        }

        // Create new polyline if trail has enough points
        if (trail.length > 1) {
            const polyline = L.polyline(trail, {
                color: '#d4af37',
                weight: 3,
                opacity: 0.7,
                deviceId: deviceId
            });

            this.trailsLayer.addLayer(polyline);
        }
    }

    updateDeviceList() {
        const devicesList = document.getElementById('devicesList');
        const devices = Array.from(this.devices.values())
            .sort((a, b) => b.received_at - a.received_at);

        if (devices.length === 0) {
            devicesList.innerHTML = `
                <div class="no-devices">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p>No devices connected</p>
                </div>
            `;
            return;
        }

        devicesList.innerHTML = devices.map(device => {
            const isOnline = this.isDeviceOnline(device);
            const lastSeen = this.formatLastSeen(device.received_at);
            const statusClass = isOnline ? 'online' : (this.isDeviceRecent(device) ? 'recent' : 'offline');

            return `
                <div class="device-item" data-device-id="${device.device_id}" onclick="dashboard.focusDevice('${device.device_id}')">
                    <div class="device-icon">
                        ${device.device_id.charAt(0).toUpperCase()}
                    </div>
                    <div class="device-info">
                        <div class="device-name">${device.device_id}</div>
                        <div class="device-status">
                            <div class="device-status-dot ${statusClass}"></div>
                            <span class="device-last-seen">${lastSeen}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();

            document.getElementById('totalDevices').textContent = stats.total_devices;
            document.getElementById('onlineDevices').textContent = stats.online_devices;
            document.getElementById('wsClients').textContent = stats.ws_clients;
            document.getElementById('uptime').textContent = this.formatUptime(stats.uptime);

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Control functions
    centerAllDevices() {
        const devices = Array.from(this.devices.values());
        if (devices.length === 0) {
            console.log('No devices to center');
            return;
        }

        const group = new L.featureGroup();
        devices.forEach(device => {
            if (this.markers.has(device.device_id)) {
                group.addLayer(this.markers.get(device.device_id));
            }
        });

        this.map.fitBounds(group.getBounds().pad(0.1));
    }

    toggleTrails() {
        this.isTrailsEnabled = !this.isTrailsEnabled;
        const btn = document.getElementById('trailsBtn');

        if (this.isTrailsEnabled) {
            btn.classList.add('active');
            this.trailsLayer.addTo(this.map);

            // Generate trails for existing devices
            this.devices.forEach((device, deviceId) => {
                if (this.trails.has(deviceId)) {
                    this.updateTrailPolyline(deviceId, this.trails.get(deviceId));
                }
            });
        } else {
            btn.classList.remove('active');
            this.map.removeLayer(this.trailsLayer);
        }
    }

    toggleClusters() {
        this.isClustersEnabled = !this.isClustersEnabled;
        const btn = document.getElementById('clustersBtn');

        if (this.isClustersEnabled) {
            btn.classList.add('active');
            this.clusterGroup.addTo(this.map);

            // Move all markers to cluster group
            this.markers.forEach(marker => {
                this.map.removeLayer(marker);
                this.clusterGroup.addLayer(marker);
            });
        } else {
            btn.classList.remove('active');
            this.map.removeLayer(this.clusterGroup);

            // Move all markers back to map
            this.markers.forEach(marker => {
                marker.addTo(this.map);
            });
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        } else {
            document.exitFullscreen();
        }
    }

    focusDevice(deviceId) {
        const marker = this.markers.get(deviceId);
        if (marker) {
            this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 15));
            marker.openPopup();
        }
    }

    filterDevices(searchTerm) {
        const deviceItems = document.querySelectorAll('.device-item');
        const term = searchTerm.toLowerCase();

        deviceItems.forEach(item => {
            const deviceId = item.dataset.deviceId.toLowerCase();
            const isVisible = deviceId.includes(term);
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }

    async refreshStats() {
        const btn = document.getElementById('refreshStatsBtn');
        btn.classList.add('rotating');

        await this.updateStats();

        setTimeout(() => {
            btn.classList.remove('rotating');
        }, 1000);
    }

    // Connection management
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    scheduleReconnect() {
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
            this.wsReconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);

            console.log(`Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.wsReconnectAttempts})`);

            setTimeout(() => {
                this.connectWebSocket();
            }, Math.min(delay, 30000)); // Max 30 seconds
        } else {
            console.log('Max WebSocket reconnect attempts reached, using polling fallback');
        }
    }

    startPolling() {
        this.pollingInterval = setInterval(async() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.log('Polling for updates (WebSocket disconnected)');
                try {
                    await this.loadInitialData();
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }
        }, this.config.pollIntervalMs);
    }

    // Utility functions
    isDeviceOnline(position) {
        const now = Date.now();
        const threshold = this.config.onlineWindowS * 1000;
        return (now - position.received_at) <= threshold;
    }

    isDeviceRecent(position) {
        const now = Date.now();
        const threshold = 5 * 60 * 1000; // 5 minutes
        return (now - position.received_at) <= threshold;
    }

    formatLastSeen(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}h ago`;
        } else {
            return `${Math.floor(diff / 86400000)}d ago`;
        }
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }

    showConnectionError(message) {
        console.error('Connection error:', message);
        // Could show a toast notification here
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    dashboard = new GPSTrackerDashboard();
});

// Add custom CSS for markers
const style = document.createElement('style');
style.textContent = `
    .custom-device-marker {
        background: transparent !important;
        border: none !important;
    }
    
    .device-marker {
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 2px solid white;
    }
    
    .device-marker.online {
        animation: pulse 2s infinite;
    }
    
    .custom-cluster {
        background: #d4af37 !important;
        color: white !important;
        border-radius: 50% !important;
        border: 2px solid white !important;
        font-weight: bold !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    
    .cluster-marker {
        font-size: 12px;
        font-weight: bold;
    }
    
    .popup-content h3 {
        margin: 0 0 0.5rem 0;
        color: #d4af37;
    }
    
    .popup-details {
        font-size: 0.875rem;
        line-height: 1.4;
    }
    
    .popup-details div {
        margin-bottom: 0.25rem;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
`;
document.head.appendChild(style);