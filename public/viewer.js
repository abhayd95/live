// Viewer Dashboard JavaScript

class ViewerDashboard extends GPSTrackerDashboard {
    constructor() {
        super();
        this.viewerFeatures = {
            readOnly: true,
            viewTrails: true,
            viewClusters: true,
            autoRefresh: true
        };
        this.autoRefreshInterval = null;
        this.showLabels = false;
    }

    async init() {
        console.log('Initializing Viewer Dashboard...');
        
        // Check authentication and viewer role
        if (!this.checkAuthentication()) {
            return;
        }
        
        // Verify viewer role (viewers can access all dashboards)
        if (!['admin', 'user', 'viewer'].includes(this.currentUser.role)) {
            console.log('Access denied: Valid role required');
            this.showAccessDeniedMessage();
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        this.initMap();
        this.setupEventListeners();
        this.setupMobileNavigation();
        this.setupViewerControls();
        await this.loadInitialData();
        this.connectWebSocket();
        this.startPolling();
        this.setupAutoRefresh();
        console.log('Viewer Dashboard initialized successfully');
    }

    setupViewerControls() {
        // View Options
        const showTrailsCheckbox = document.getElementById('showTrails');
        const showClustersCheckbox = document.getElementById('showClusters');
        const autoRefreshCheckbox = document.getElementById('autoRefresh');
        const showLabelsCheckbox = document.getElementById('showLabels');

        if (showTrailsCheckbox) {
            showTrailsCheckbox.addEventListener('change', (e) => {
                this.toggleTrails(e.target.checked);
            });
        }

        if (showClustersCheckbox) {
            showClustersCheckbox.addEventListener('change', (e) => {
                this.toggleClusters(e.target.checked);
            });
        }

        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        }

        if (showLabelsCheckbox) {
            showLabelsCheckbox.addEventListener('change', (e) => {
                this.toggleLabels(e.target.checked);
            });
        }

        // Auto-hide info panel
        setTimeout(() => {
            const infoPanel = document.querySelector('.viewer-info-panel');
            if (infoPanel) {
                infoPanel.style.opacity = '0.3';
                infoPanel.style.transform = 'translateX(-50%)';
            }
        }, 8000);
    }

    setupAutoRefresh() {
        const autoRefreshCheckbox = document.getElementById('autoRefresh');
        if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
            this.startAutoRefresh();
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            this.refreshData();
        }, 30000); // Refresh every 30 seconds
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async refreshData() {
        try {
            await this.loadInitialData();
            this.updateStats();
            this.showNotification('Data refreshed', 'info');
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.startAutoRefresh();
            this.showNotification('Auto refresh enabled', 'success');
        } else {
            this.stopAutoRefresh();
            this.showNotification('Auto refresh disabled', 'info');
        }
    }

    toggleTrails(enabled) {
        if (enabled) {
            this.showTrails = true;
            this.updateTrails();
            this.showNotification('Trails enabled', 'success');
        } else {
            this.showTrails = false;
            this.clearTrails();
            this.showNotification('Trails disabled', 'info');
        }
    }

    toggleClusters(enabled) {
        if (enabled) {
            this.showClusters = true;
            this.updateClusters();
            this.showNotification('Clusters enabled', 'success');
        } else {
            this.showClusters = false;
            this.clearClusters();
            this.showNotification('Clusters disabled', 'info');
        }
    }

    toggleLabels(enabled) {
        this.showLabels = enabled;
        
        // Update all markers to show/hide labels
        this.markers.forEach((marker, deviceId) => {
            if (enabled) {
                marker.bindTooltip(deviceId, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -10],
                    className: 'device-label'
                });
            } else {
                marker.unbindTooltip();
            }
        });
        
        this.showNotification(`Labels ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }

    // Override device display to show read-only information
    displayDevices(devices) {
        const deviceList = document.getElementById('deviceList');
        if (!deviceList) return;

        deviceList.innerHTML = devices.map(device => {
            const position = this.devicePositions.get(device.device_id);
            const isOnline = position && (Date.now() - position.ts) < (60 * 1000); // Online if updated within last minute
            
            return `
                <div class="device-item viewer" data-device-id="${device.device_id}">
                    <div class="device-info">
                        <div class="device-header">
                            <div class="device-name">${device.name || device.device_id}</div>
                            <div class="device-status ${isOnline ? 'online' : 'offline'}">
                                ${isOnline ? 'Online' : 'Offline'}
                            </div>
                        </div>
                        <div class="device-details">
                            <div class="device-detail">
                                <span class="detail-label">ID:</span>
                                <span class="detail-value">${device.device_id}</span>
                            </div>
                            ${position ? `
                                <div class="device-detail">
                                    <span class="detail-label">Speed:</span>
                                    <span class="detail-value">${position.speed ? position.speed.toFixed(1) + ' km/h' : 'N/A'}</span>
                                </div>
                                <div class="device-detail">
                                    <span class="detail-label">Satellites:</span>
                                    <span class="detail-value">${position.sats || 'N/A'}</span>
                                </div>
                                <div class="device-detail">
                                    <span class="detail-label">Last Update:</span>
                                    <span class="detail-value">${this.formatLastSeen(position.ts)}</span>
                                </div>
                            ` : `
                                <div class="device-detail">
                                    <span class="detail-label">Status:</span>
                                    <span class="detail-value">No recent data</span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatLastSeen(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
    }

    // Override stats update for viewer-specific stats
    async updateStats() {
        try {
            const response = await this.authenticatedFetch('/api/stats');
            if (!response || !response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();
            
            // Update viewer-specific stats
            document.getElementById('totalDevices').textContent = stats.totalDevices || 0;
            document.getElementById('onlineDevices').textContent = stats.onlineDevices || 0;
            document.getElementById('activeSessions').textContent = stats.wsClients || 0;
            document.getElementById('systemStatus').textContent = stats.mqttConnected ? 'Online' : 'Offline';

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    ${this.getNotificationIcon(type)}
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000); // Shorter duration for viewer notifications
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success':
                return '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
            case 'error':
                return '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';
            case 'warning':
                return '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>';
            default:
                return '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>';
        }
    }

    // Override device selection to show read-only popup
    selectDevice(deviceId) {
        const device = this.devices.get(deviceId);
        const position = this.devicePositions.get(deviceId);
        
        if (!device) return;

        // Create a read-only popup
        const popupContent = `
            <div class="device-popup viewer">
                <h4>${device.name || deviceId}</h4>
                <div class="popup-details">
                    <p><strong>Device ID:</strong> ${deviceId}</p>
                    <p><strong>Type:</strong> ${device.device_type || 'Unknown'}</p>
                    <p><strong>Status:</strong> ${position ? 'Online' : 'Offline'}</p>
                    ${position ? `
                        <p><strong>Speed:</strong> ${position.speed ? position.speed.toFixed(1) + ' km/h' : 'N/A'}</p>
                        <p><strong>Satellites:</strong> ${position.sats || 'N/A'}</p>
                        <p><strong>Last Update:</strong> ${this.formatLastSeen(position.ts)}</p>
                    ` : `
                        <p><strong>Last Update:</strong> No recent data</p>
                    `}
                </div>
                <div class="popup-note">
                    <small>Viewer Mode - Read Only Access</small>
                </div>
            </div>
        `;

        // Find the marker and show popup
        const marker = this.markers.get(deviceId);
        if (marker) {
            marker.bindPopup(popupContent).openPopup();
        }
    }

    // Cleanup on destroy
    destroy() {
        super.destroy();
        this.stopAutoRefresh();
    }
}

// Initialize Viewer Dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.viewerDashboard = new ViewerDashboard();
});
