// Authentication JavaScript

class AuthManager {
    constructor() {
        this.apiBase = '/api/auth';
        this.tokenKey = 'gps_tracker_token';
        this.userKey = 'gps_tracker_user';
        
        this.init();
    }

    init() {
        // Check if user is already logged in
        if (this.isLoggedIn() && window.location.pathname === '/login.html') {
            window.location.href = '/';
            return;
        }

        // Initialize form handlers
        this.setupPasswordToggles();
        this.setupFormValidation();
        this.setupFormSubmission();
    }

    setupPasswordToggles() {
        const passwordToggles = document.querySelectorAll('.password-toggle');
        
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const input = toggle.parentElement.querySelector('input');
                const isPassword = input.type === 'password';
                
                input.type = isPassword ? 'text' : 'password';
                toggle.innerHTML = isPassword ? 
                    '<svg class="eye-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>' :
                    '<svg class="eye-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
            });
        });
    }

    setupFormValidation() {
        // Password strength indicator for signup
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const passwordStrength = document.getElementById('passwordStrength');

        if (passwordInput && passwordStrength) {
            passwordInput.addEventListener('input', () => {
                this.updatePasswordStrength(passwordInput.value, passwordStrength);
            });
        }

        if (confirmPasswordInput && passwordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.validatePasswordMatch(passwordInput.value, confirmPasswordInput.value);
            });
        }

        // Real-time validation
        const inputs = document.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
        });
    }

    setupFormSubmission() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }
    }

    updatePasswordStrength(password, strengthElement) {
        if (!strengthElement) return;

        const score = this.calculatePasswordStrength(password);
        
        strengthElement.className = 'password-strength';
        
        if (password.length === 0) return;
        
        if (score < 25) {
            strengthElement.classList.add('weak');
        } else if (score < 50) {
            strengthElement.classList.add('fair');
        } else if (score < 75) {
            strengthElement.classList.add('good');
        } else {
            strengthElement.classList.add('strong');
        }
    }

    calculatePasswordStrength(password) {
        let score = 0;
        
        // Length
        if (password.length >= 8) score += 25;
        else if (password.length >= 6) score += 15;
        
        // Character variety
        if (/[a-z]/.test(password)) score += 10;
        if (/[A-Z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 10;
        if (/[^A-Za-z0-9]/.test(password)) score += 15;
        
        // Common patterns
        if (!/(.)\1{2,}/.test(password)) score += 10;
        if (!/123|abc|qwe/i.test(password)) score += 10;
        
        return Math.min(score, 100);
    }

    validatePasswordMatch(password, confirmPassword) {
        const errorElement = document.getElementById('confirmPasswordError');
        if (!errorElement) return true;

        if (confirmPassword && password !== confirmPassword) {
            this.showError('confirmPasswordError', 'Passwords do not match');
            return false;
        } else {
            this.hideError('confirmPasswordError');
            return true;
        }
    }

    validateField(field) {
        const fieldName = field.name;
        const value = field.value.trim();

        // Clear previous errors
        this.hideError(`${fieldName}Error`);

        // Required field validation
        if (field.required && !value) {
            this.showError(`${fieldName}Error`, 'This field is required');
            return false;
        }

        // Specific field validations
        switch (fieldName) {
            case 'username':
                if (value && (value.length < 3 || value.length > 50)) {
                    this.showError(`${fieldName}Error`, 'Username must be 3-50 characters');
                    return false;
                }
                break;
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    this.showError(`${fieldName}Error`, 'Please enter a valid email address');
                    return false;
                }
                break;
            case 'password':
                if (value && value.length < 6) {
                    this.showError(`${fieldName}Error`, 'Password must be at least 6 characters');
                    return false;
                }
                break;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.classList.remove('show');
        }
    }

    hideAllErrors() {
        const errorElements = document.querySelectorAll('.form-error');
        errorElements.forEach(element => {
            element.classList.remove('show');
        });
    }

    async handleLogin() {
        const form = document.getElementById('loginForm');
        const button = document.getElementById('loginButton');
        const spinner = document.getElementById('loginSpinner');

        // Validate form
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Client-side validation
        let isValid = true;
        if (!data.username) {
            this.showError('usernameError', 'Username or email is required');
            isValid = false;
        }
        if (!data.password) {
            this.showError('passwordError', 'Password is required');
            isValid = false;
        }

        if (!isValid) return;

        // Show loading state
        this.setLoadingState(button, spinner, true);

        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: data.username,
                    password: data.password
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Store token and user data
                localStorage.setItem(this.tokenKey, result.token);
                localStorage.setItem(this.userKey, JSON.stringify(result.user));
                
                // Redirect to dashboard
                window.location.href = '/';
            } else {
                this.showError('generalError', result.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('generalError', 'Network error. Please try again.');
        } finally {
            this.setLoadingState(button, spinner, false);
        }
    }

    async handleSignup() {
        const form = document.getElementById('signupForm');
        const button = document.getElementById('signupButton');
        const spinner = document.getElementById('signupSpinner');

        // Validate form
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Client-side validation
        let isValid = true;
        
        if (!data.username || data.username.length < 3) {
            this.showError('usernameError', 'Username must be at least 3 characters');
            isValid = false;
        }
        
        if (!data.email || !this.isValidEmail(data.email)) {
            this.showError('emailError', 'Please enter a valid email address');
            isValid = false;
        }
        
        if (!data.password || data.password.length < 6) {
            this.showError('passwordError', 'Password must be at least 6 characters');
            isValid = false;
        }
        
        if (!this.validatePasswordMatch(data.password, data.confirmPassword)) {
            isValid = false;
        }

        // Check terms agreement
        const agreeTerms = document.getElementById('agreeTerms');
        if (!agreeTerms.checked) {
            this.showError('generalError', 'Please agree to the Terms of Service and Privacy Policy');
            isValid = false;
        }

        if (!isValid) return;

        // Show loading state
        this.setLoadingState(button, spinner, true);

        try {
            const response = await fetch(`${this.apiBase}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: data.username,
                    email: data.email,
                    password: data.password,
                    full_name: data.full_name || null
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Show success message and redirect to login
                this.showSuccess('Account created successfully! Please sign in.');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                if (result.details && Array.isArray(result.details)) {
                    // Show validation errors
                    result.details.forEach(detail => {
                        this.showError(`${detail.path}Error`, detail.msg);
                    });
                } else {
                    this.showError('generalError', result.error || 'Registration failed');
                }
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('generalError', 'Network error. Please try again.');
        } finally {
            this.setLoadingState(button, spinner, false);
        }
    }

    setLoadingState(button, spinner, isLoading) {
        if (button && spinner) {
            if (isLoading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }

    showSuccess(message) {
        this.hideAllErrors();
        const successDiv = document.createElement('div');
        successDiv.className = 'auth-success';
        successDiv.textContent = message;
        
        const form = document.querySelector('.auth-form');
        form.insertBefore(successDiv, form.firstChild);
        
        setTimeout(() => {
            successDiv.remove();
        }, 5000);
    }

    isLoggedIn() {
        const token = localStorage.getItem(this.tokenKey);
        const user = localStorage.getItem(this.userKey);
        return !!(token && user);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    getUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        window.location.href = 'login.html';
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
