// Neumorphism Login Form JavaScript
class NeumorphismLoginForm {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.submitButton = this.form.querySelector('.login-btn');
        this.successMessage = document.getElementById('successMessage');
        this.socialButtons = document.querySelectorAll('.neu-social');
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupPasswordToggle();
        this.setupSocialButtons();
        this.setupNeumorphicEffects();
        this.loadSavedCredentials();
    }
    
    bindEvents() {
        if (!this.form) return;

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        if (this.usernameInput) {
            this.usernameInput.addEventListener('blur', () => this.validateUsername());
            this.usernameInput.addEventListener('input', () => this.clearError('username'));

            this.usernameInput.addEventListener('focus', (e) => this.addSoftPress(e));
            this.usernameInput.addEventListener('blur', (e) => this.removeSoftPress(e));
        }

        if (this.passwordInput) {
            this.passwordInput.addEventListener('blur', () => this.validatePassword());
            this.passwordInput.addEventListener('input', () => this.clearError('password'));

            this.passwordInput.addEventListener('focus', (e) => this.addSoftPress(e));
            this.passwordInput.addEventListener('blur', (e) => this.removeSoftPress(e));
        }
    }


    loadSavedCredentials() {
        const saved = localStorage.getItem("zodiac_login");

        if (!saved) return;

        const { username, password } = JSON.parse(saved);

        if (username && password) {
            document.getElementById("username").value = username;
            this.passwordInput.value = password;
            document.getElementById("remember").checked = true;
        }
    }

    saveCredentials(username, password) {
        const remember = document.getElementById("remember").checked;

        if (!remember) {
            localStorage.removeItem("zodiac_login");
            return;
        }

        localStorage.setItem(
            "zodiac_login",
            JSON.stringify({ username, password })
        );
    }

    
    setupPasswordToggle() {
        this.passwordToggle.addEventListener('click', () => {
            const isHidden = this.passwordInput.type === 'password';

            this.passwordInput.type = isHidden ? 'text' : 'password';

            this.passwordToggle.classList.toggle('show-password', isHidden);

            this.animateSoftPress(this.passwordToggle);
        });
    }

    validateUsername() {
        const value = this.usernameInput.value.trim();

        if (!value) {
            this.showError('username', 'Username is required');
            return false;
        }

        this.clearError('username');
        return true;
    }


    
    setupSocialButtons() {
        this.socialButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.animateSoftPress(button);
                
                // Determine which social platform based on SVG content
                const svgPath = button.querySelector('svg path').getAttribute('d');
                let provider = 'Social';
                if (svgPath.includes('22.56')) provider = 'Google';
                else if (svgPath.includes('github')) provider = 'GitHub';
                else if (svgPath.includes('23.953')) provider = 'Twitter';
                
                this.handleSocialLogin(provider, button);
            });
        });
    }
    
    setupNeumorphicEffects() {
        // Add hover effects to all neumorphic elements
        const neuElements = document.querySelectorAll('.neu-icon, .neu-checkbox, .neu-social');
        neuElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'scale(1.05)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
            });
        });
        
        // Add ambient light effect on mouse move
        document.addEventListener('mousemove', (e) => {
            this.updateAmbientLight(e);
        });
    }
    
    updateAmbientLight(e) {
        const card = document.querySelector('.login-card');
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const angleX = (x - centerX) / centerX;
        const angleY = (y - centerY) / centerY;
        
        const shadowX = angleX * 30;
        const shadowY = angleY * 30;
        
        card.style.boxShadow = `
            ${shadowX}px ${shadowY}px 60px #bec3cf,
            ${-shadowX}px ${-shadowY}px 60px #ffffff
        `;
    }
    
    addSoftPress(e) {
        const inputGroup = e.target.closest('.neu-input');
        inputGroup.style.transform = 'scale(0.98)';
    }
    
    removeSoftPress(e) {
        const inputGroup = e.target.closest('.neu-input');
        inputGroup.style.transform = 'scale(1)';
    }
    
    animateSoftPress(element) {
        element.style.scale = '0.9';
        setTimeout(() => {
            element.style.scale = '1';
        }, 120);
    }

    
    validateusername() {
        const username = this.usernameInput.value.trim();
        const usernameRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!username) {
            this.showError('username', 'username is required');
            return false;
        }
        
        if (!usernameRegex.test(username)) {
            this.showError('username', 'Please enter a valid username');
            return false;
        }
        
        this.clearError('username');
        return true;
    }
    
    validatePassword() {
        const password = this.passwordInput.value;
        
        if (!password) {
            this.showError('password', 'Password is required');
            return false;
        }
        
        if (password.length < 6) {
            this.showError('password', 'Password must be at least 6 characters');
            return false;
        }
        
        this.clearError('password');
        return true;
    }
    
    showError(field, message) {
        const formGroup = document.getElementById(field).closest('.form-group');
        const errorElement = document.getElementById(`${field}Error`);
        
        formGroup.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // Add gentle shake animation
        const input = document.getElementById(field);
        input.style.animation = 'gentleShake 0.5s ease-in-out';
        setTimeout(() => {
            input.style.animation = '';
        }, 500);
    }
    
    clearError(field) {
        const formGroup = document.getElementById(field).closest('.form-group');
        const errorElement = document.getElementById(`${field}Error`);
        
        formGroup.classList.remove('error');
        errorElement.classList.remove('show');
        setTimeout(() => {
            errorElement.textContent = '';
        }, 300);
    }
    
    async handleSubmit(e) {
        e.preventDefault();

        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.showError('password', 'Username and password required');
            return;
        }

        this.setLoading(true);

        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!data.success) {
                this.showError('password', data.message);
                return;
            }

            this.saveCredentials(username, password);
            this.showNeumorphicSuccess();

            setTimeout(() => {
                window.location.href = data.redirect;
            }, 1200);

        } catch (err) {
            this.showError('password', 'Login failed');
        } finally {
            this.setLoading(false);
        }
    }

    
    async handleSocialLogin(provider, button) {
        console.log(`Initiating ${provider} login...`);
        
        // Add loading state to button
        button.style.pointerEvents = 'none';
        button.style.opacity = '0.7';
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log(`Redirecting to ${provider} authentication...`);
            // window.location.href = `/auth/${provider.toLowerCase()}`;
        } catch (error) {
            console.error(`${provider} authentication failed: ${error.message}`);
        } finally {
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
        }
    }
    
    setLoading(loading) {
        this.submitButton.classList.toggle('loading', loading);
        this.submitButton.disabled = loading;
        
        // Disable social buttons during login
        this.socialButtons.forEach(button => {
            button.style.pointerEvents = loading ? 'none' : 'auto';
            button.style.opacity = loading ? '0.6' : '1';
        });
    }
    
    showNeumorphicSuccess() {
        // Soft fade out form
        this.form.style.transform = 'scale(0.95)';
        this.form.style.opacity = '0';
        
        setTimeout(() => {
            this.form.style.display = 'none';
            document.querySelector('.social-login').style.display = 'none';
            document.querySelector('.signup-link').style.display = 'none';
            
            // Show success with soft animation
            this.successMessage.classList.add('show');
            
            // Animate success icon
            const successIcon = this.successMessage.querySelector('.neu-icon');
            successIcon.style.animation = 'successPulse 0.6s ease-out';
            
        }, 300);
        
        // Simulate redirect
        setTimeout(() => {
            console.log('Redirecting to dashboard...');
            // window.location.href = '/dashboard';
        }, 2500);
    }
}

// Add custom animations
if (!document.querySelector('#neu-keyframes')) {
    const style = document.createElement('style');
    style.id = 'neu-keyframes';
    style.textContent = `
        @keyframes gentleShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-3px); }
            75% { transform: translateX(3px); }
        }
        
        @keyframes successPulse {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NeumorphismLoginForm();
});