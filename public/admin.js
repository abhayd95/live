// Admin Dashboard JavaScript

class AdminDashboard extends GPSTrackerDashboard {
    constructor() {
        super();
        this.adminFeatures = {
            userManagement: true,
            systemSettings: true,
            deviceManagement: true,
            emergencyControls: true,
            dataExport: true
        };
    }

    async init() {
        console.log('Initializing Admin Dashboard...');

        // Check authentication and admin role
        if (!this.checkAuthentication()) {
            return;
        }

        // Verify admin role
        if (this.currentUser.role !== 'admin') {
            console.log('Access denied: Admin role required');
            this.showAccessDeniedMessage();
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }

        this.initMap();
        this.setupEventListeners();
        this.setupMobileNavigation();
        this.setupAdminControls();
        await this.loadInitialData();
        this.connectWebSocket();
        this.startPolling();
        console.log('Admin Dashboard initialized successfully');
    }

    setupAdminControls() {
        // User Management Modal
        const userManagementBtn = document.getElementById('manageUsers');
        const userManagementModal = document.getElementById('userManagementModal');

        if (userManagementBtn && userManagementModal) {
            userManagementBtn.addEventListener('click', () => {
                this.showModal('userManagementModal');
                this.loadUsers();
            });
        }

        // System Settings Modal
        const systemSettingsBtn = document.getElementById('systemSettings');
        const systemSettingsModal = document.getElementById('systemSettingsModal');

        if (systemSettingsBtn && systemSettingsModal) {
            systemSettingsBtn.addEventListener('click', () => {
                this.showModal('systemSettingsModal');
            });
        }

        // Emergency Stop
        const emergencyStopBtn = document.getElementById('emergencyStop');
        if (emergencyStopBtn) {
            emergencyStopBtn.addEventListener('click', () => {
                this.showEmergencyStopConfirmation();
            });
        }

        // Export Data
        const exportDataBtn = document.getElementById('exportData');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportSystemData();
            });
        }

        // Add Device
        const addDeviceBtn = document.getElementById('addDevice');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', () => {
                this.showAddDeviceModal();
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
        }
    }

    async loadUsers() {
        try {
            const response = await this.authenticatedFetch('/api/admin/users');
            if (!response || !response.ok) {
                throw new Error('Failed to load users');
            }

            const users = await response.json();
            this.displayUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Error loading users', 'error');
        }
    }

    displayUsers(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;

        userList.innerHTML = users.map(user => `
            <div class="user-item" data-user-id="${user.id}">
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-email">${user.email}</div>
                    <div class="user-role ${user.role}">${user.role}</div>
                </div>
                <div class="user-actions">
                    <button class="user-action-btn" onclick="adminDashboard.editUser(${user.id})" title="Edit User">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="user-action-btn danger" onclick="adminDashboard.deleteUser(${user.id})" title="Delete User">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    editUser(userId) {
        console.log('Edit user:', userId);
        this.showNotification('Edit user functionality coming soon', 'info');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await this.authenticatedFetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to delete user');
            }

            this.showNotification('User deleted successfully', 'success');
            this.loadUsers(); // Refresh the list
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Error deleting user', 'error');
        }
    }

    showEmergencyStopConfirmation() {
        if (!confirm('Are you sure you want to perform an emergency stop? This will:\n\n• Stop all tracking operations\n• Disconnect all devices\n• Halt data collection\n\nThis action requires manual intervention to restart the system.')) {
            return;
        }

        this.performEmergencyStop();
    }

    async performEmergencyStop() {
        try {
            const response = await this.authenticatedFetch('/api/admin/emergency-stop', {
                method: 'POST'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to perform emergency stop');
            }

            this.showNotification('Emergency stop initiated', 'warning');
        } catch (error) {
            console.error('Error performing emergency stop:', error);
            this.showNotification('Error performing emergency stop', 'error');
        }
    }

    async exportSystemData() {
        try {
            this.showNotification('Exporting system data...', 'info');

            const response = await this.authenticatedFetch('/api/admin/export-data', {
                method: 'GET'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to export data');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gps-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
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

    showAddDeviceModal() {
        // Create a simple prompt for now
        const deviceId = prompt('Enter device ID:');
        const deviceName = prompt('Enter device name:');

        if (deviceId && deviceName) {
            this.addDevice(deviceId, deviceName);
        }
    }

    async addDevice(deviceId, deviceName) {
        try {
            const response = await this.authenticatedFetch('/api/admin/devices', {
                method: 'POST',
                body: JSON.stringify({
                    device_id: deviceId,
                    name: deviceName,
                    description: 'Added via admin panel'
                })
            });

            if (!response || !response.ok) {
                throw new Error('Failed to add device');
            }

            this.showNotification('Device added successfully', 'success');
            this.loadInitialData(); // Refresh device list
        } catch (error) {
            console.error('Error adding device:', error);
            this.showNotification('Error adding device', 'error');
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

    // Override device display for admin features
    displayDevices(devices) {
        super.displayDevices(devices);

        // Add admin-specific device actions
        const deviceItems = document.querySelectorAll('.device-item');
        deviceItems.forEach(item => {
            const deviceId = item.dataset.deviceId;
            const actionsContainer = item.querySelector('.device-info');

            if (actionsContainer && !item.querySelector('.device-actions')) {
                const actions = document.createElement('div');
                actions.className = 'device-actions';
                actions.innerHTML = `
                    <button class="device-action-btn" onclick="adminDashboard.editDevice('${deviceId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="device-action-btn danger" onclick="adminDashboard.deleteDevice('${deviceId}')">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Delete
                    </button>
                `;
                actionsContainer.appendChild(actions);
            }
        });
    }

    editDevice(deviceId) {
        console.log('Edit device:', deviceId);
        this.showNotification('Edit device functionality coming soon', 'info');
    }

    async deleteDevice(deviceId) {
        if (!confirm(`Are you sure you want to delete device "${deviceId}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await this.authenticatedFetch(`/api/admin/devices/${deviceId}`, {
                method: 'DELETE'
            });

            if (!response || !response.ok) {
                throw new Error('Failed to delete device');
            }

            this.showNotification('Device deleted successfully', 'success');
            this.loadInitialData(); // Refresh device list
        } catch (error) {
            console.error('Error deleting device:', error);
            this.showNotification('Error deleting device', 'error');
        }
    }
}

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});