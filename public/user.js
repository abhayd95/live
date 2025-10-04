// User Dashboard JavaScript

class UserDashboard extends GPSTrackerDashboard {
    constructor() {
        super();
        this.userFeatures = {
            deviceManagement: true,
            dataExport: true,
            locationSharing: true,
            historyView: true
        };
        this.myDevices = new Map();
    }

    async init() {
        console.log('Initializing User Dashboard...');

        // Check authentication and user role
        if (!this.checkAuthentication()) {
            return;
        }

        // Verify user role
        if (!['admin', 'user'].includes(this.currentUser.role)) {
            console.log('Access denied: User role required');
            this.showAccessDeniedMessage();
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }

        this.initMap();
        this.setupEventListeners();
        this.setupMobileNavigation();
        this.setupUserControls();
        await this.loadInitialData();
        this.connectWebSocket();
        this.startPolling();
        console.log('User Dashboard initialized successfully');
    }

    setupUserControls() {
        // Add Device Modal
        const addDeviceBtn = document.getElementById('addMyDevice');
        const addDeviceModal = document.getElementById('addDeviceModal');

        if (addDeviceBtn && addDeviceModal) {
            addDeviceBtn.addEventListener('click', () => {
                this.showModal('addDeviceModal');
            });
        }

        // Export Data
        const exportDataBtn = document.getElementById('exportMyData');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportMyData();
            });
        }

        // View History
        const viewHistoryBtn = document.getElementById('viewHistory');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.showHistoryModal();
            });
        }

        // Share Location
        const shareLocationBtn = document.getElementById('shareLocation');
        if (shareLocationBtn) {
            shareLocationBtn.addEventListener('click', () => {
                this.shareLocation();
            });
        }

        // Save Device
        const saveDeviceBtn = document.getElementById('saveDevice');
        if (saveDeviceBtn) {
            saveDeviceBtn.addEventListener('click', () => {
                this.saveDevice();
            });
        }

        // Modal close handlers
        this.setupModalHandlers();
    }

    setupModalHandlers() {
        const modals = document.querySelectorAll('.modal');
        const closeBtns = document.querySelectorAll('.modal-close');

        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideModal(btn.closest('.modal').id);
            });
        });

        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    this.hideModal(openModal.id);
                }
            }
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            this.clearForm();
        }
    }

    clearForm() {
        const deviceId = document.getElementById('deviceId');
        const deviceName = document.getElementById('deviceName');
        const deviceDescription = document.getElementById('deviceDescription');

        if (deviceId) deviceId.value = '';
        if (deviceName) deviceName.value = '';
        if (deviceDescription) deviceDescription.value = '';
    }

    async saveDevice() {
        const deviceId = document.getElementById('deviceId') ? .value.trim();
        const deviceName = document.getElementById('deviceName') ? .value.trim();
        const deviceDescription = document.getElementById('deviceDescription') ? .value.trim();

        if (!deviceId || !deviceName) {
            this.showNotification('Please fill in device ID and name', 'warning');
            return;
        }

        try {
            const response = await this.authenticatedFetch('/api/user/devices', {
                method: 'POST',
                body: JSON.stringify({
                    device_id: deviceId,
                    name: deviceName,
                    description: deviceDescription || 'Added via user dashboard'
                })
            });

            if (!response || !response.ok) {
                throw new Error('Failed to add device');
            }

            this.showNotification('Device added successfully', 'success');
            this.hideModal('addDeviceModal');
            this.loadInitialData(); // Refresh device list
        } catch (error) {
            console.error('Error adding device:', error);
            this.showNotification('Error adding device', 'error');
        }
    }

    async exportMyData() {
        try {
            this.showNotification('Exporting your data...', 'info');

            const response = await this.authenticatedFetch('/api/user/export-data', {
                method: 'GET'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to export data');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-gps-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showNotification('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error exporting data', 'error');
        }
    }

    showHistoryModal() {
        this.showNotification('History view functionality coming soon', 'info');
    }

    shareLocation() {
        if (navigator.share) {
            // Use Web Share API if available
            navigator.share({
                title: 'My GPS Location',
                text: 'Check out my current location',
                url: window.location.href
            }).catch(err => {
                console.log('Error sharing:', err);
                this.fallbackShare();
            });
        } else {
            this.fallbackShare();
        }
    }

    fallbackShare() {
        // Fallback to copying URL to clipboard
        navigator.clipboard.writeText(window.location.href).then(() => {
            this.showNotification('Location URL copied to clipboard', 'success');
        }).catch(err => {
            console.log('Error copying to clipboard:', err);
            this.showNotification('Unable to share location', 'error');
        });
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
        }, 3000);
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

    // Override device loading to filter user's devices
    async loadInitialData() {
        try {
            console.log('Loading user device data...');

            // Load user's devices instead of all devices
            const response = await this.authenticatedFetch('/api/user/devices');
            if (!response || !response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.myDevices.clear();

            // Store user's devices
            data.devices.forEach(device => {
                this.myDevices.set(device.device_id, device);
            });

            console.log(`Loaded ${data.devices.length} user devices`);

            // Load positions for user's devices only
            const positionsResponse = await this.authenticatedFetch('/api/user/positions');
            if (positionsResponse && positionsResponse.ok) {
                const positionsData = await positionsResponse.json();
                positionsData.positions.forEach(position => {
                    this.devicePositions.set(position.device_id, position);
                    this.updateDeviceMarker(position);
                });
            }

            this.displayDevices(Array.from(this.myDevices.values()));
            this.updateStats();
            this.centerMapOnDevices();

        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Override stats update for user-specific stats
    async updateStats() {
        try {
            const response = await this.authenticatedFetch('/api/user/stats');
            if (!response || !response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const stats = await response.json();

            // Update user-specific stats
            document.getElementById('myDevices').textContent = stats.totalDevices || 0;
            document.getElementById('onlineDevices').textContent = stats.onlineDevices || 0;
            document.getElementById('lastUpdate').textContent = stats.lastUpdate || '--';
            document.getElementById('totalDistance').textContent = `${stats.totalDistance || 0} km`;

        } catch (error) {
            console.error('Error updating user stats:', error);
        }
    }

    // Override device display for user features
    displayDevices(devices) {
        super.displayDevices(devices);

        // Add user-specific device actions
        const deviceItems = document.querySelectorAll('.device-item');
        deviceItems.forEach(item => {
            const deviceId = item.dataset.deviceId;
            const actionsContainer = item.querySelector('.device-info');

            if (actionsContainer && !item.querySelector('.device-actions.user')) {
                const actions = document.createElement('div');
                actions.className = 'device-actions user';
                actions.innerHTML = `
                    <button class="device-action-btn user" onclick="userDashboard.editMyDevice('${deviceId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="device-action-btn user" onclick="userDashboard.viewDeviceHistory('${deviceId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z"/>
                        </svg>
                        History
                    </button>
                    <button class="device-action-btn user danger" onclick="userDashboard.removeMyDevice('${deviceId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Remove
                    </button>
                `;
                actionsContainer.appendChild(actions);
            }
        });
    }

    editMyDevice(deviceId) {
        console.log('Edit my device:', deviceId);
        this.showNotification('Edit device functionality coming soon', 'info');
    }

    viewDeviceHistory(deviceId) {
        console.log('View device history:', deviceId);
        this.showNotification('Device history view coming soon', 'info');
    }

    async removeMyDevice(deviceId) {
        if (!confirm(`Are you sure you want to remove device "${deviceId}" from your account?`)) {
            return;
        }

        try {
            const response = await this.authenticatedFetch(`/api/user/devices/${deviceId}`, {
                method: 'DELETE'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to remove device');
            }

            this.showNotification('Device removed successfully', 'success');
            this.loadInitialData(); // Refresh device list
        } catch (error) {
            console.error('Error removing device:', error);
            this.showNotification('Error removing device', 'error');
        }
    }
}

// Initialize User Dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.userDashboard = new UserDashboard();
});