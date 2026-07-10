import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://rccvnnmhkxksmlccakjq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjY3Zubm1oa3hrc21sY2Nha2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MTI5ODgsImV4cCI6MjA5OTA4ODk4OH0.xPbtrb3paV7_WybogcsV68U0WzAX14-ugLf9CnlcoJc';

const supabase = createClient(supabaseUrl, supabaseKey);

let isLoginMode = true;

const authForm = document.getElementById('authForm');
const switchModeBtn = document.getElementById('switchModeBtn');
const toggleText = document.getElementById('toggleText');
const btnText = document.getElementById('btnText');
const submitBtn = document.getElementById('submitBtn');
const regFields = document.getElementById('regFields');
const errorDiv = document.getElementById('authError');
const successDiv = document.getElementById('authSuccess');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nameInput = document.getElementById('regName');

const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const nameError = document.getElementById('nameError');

function setInlineError(input, errorEl, msg) {
    input.classList.add('error-border');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function clearInlineErrors() {
    [emailInput, passwordInput, nameInput].forEach(input => input.classList.remove('error-border'));
    [emailError, passwordError, nameError].forEach(el => el.classList.add('hidden'));
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    if (successDiv) successDiv.classList.add('hidden');
}

function showSuccess(msg) {
    if (successDiv) {
        successDiv.textContent = msg;
        successDiv.classList.remove('hidden');
    }
    errorDiv.classList.add('hidden');
}

function clearMessages() {
    errorDiv.classList.add('hidden');
    if (successDiv) successDiv.classList.add('hidden');
    errorDiv.textContent = '';
    if (successDiv) successDiv.textContent = '';
    clearInlineErrors();
}

switchModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    clearMessages();
    
    if (isLoginMode) {
        regFields.classList.add('hidden');
        regFields.classList.remove('flex');
        btnText.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        switchModeBtn.textContent = 'Sign up';
        document.getElementById('formTitle').textContent = 'Log in to Labh';
        document.getElementById('formSubtitle').textContent = 'Enter your details below to continue.';
    } else {
        regFields.classList.remove('hidden');
        regFields.classList.add('flex');
        btnText.textContent = 'Create Account';
        toggleText.textContent = 'Already have an account?';
        switchModeBtn.textContent = 'Log in';
        document.getElementById('formTitle').textContent = 'Create your account';
        document.getElementById('formSubtitle').textContent = 'Sign up to start trading with precision.';
    }
});

function setButtonLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.textContent = isLoginMode ? 'Signing in...' : 'Creating account...';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    }
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    let hasInlineError = false;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const name = nameInput.value.trim();

    if (!email) {
        setInlineError(emailInput, emailError, 'Enter a valid email address');
        hasInlineError = true;
    }
    
    if (!password) {
        setInlineError(passwordInput, passwordError, 'Password is required');
        hasInlineError = true;
    }

    if (!isLoginMode && !name) {
        setInlineError(nameInput, nameError, 'Full name is required');
        hasInlineError = true;
    }

    if (hasInlineError) return;

    setButtonLoading(true);
    
    if (isLoginMode) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            setButtonLoading(false);
            showError(error.message);
        } else {
            // Set localStorage user so index.html authentication guard passes
            const user = data.user;
            const userName = user.user_metadata?.full_name || user.email.split('@')[0] || 'Trader';
            localStorage.setItem("labh_user", JSON.stringify({ name: userName, email: user.email }));

            // Handle Remember Me
            const rememberMeCheckbox = document.getElementById('rememberMe');
            if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                localStorage.setItem('labh_remembered_email', email);
            } else {
                localStorage.removeItem('labh_remembered_email');
            }

            showSuccess('Logged in successfully! Redirecting...');
            btnText.textContent = 'Redirecting...';
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }
    } else {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });
        
        setButtonLoading(false);
        
        if (error) {
            showError(error.message);
        } else {
            showSuccess('Account created! You can now sign in.');
            // Automatically switch back to login mode after success
            setTimeout(() => {
                isLoginMode = true;
                regFields.classList.add('hidden');
                regFields.classList.remove('flex');
                btnText.textContent = 'Sign In';
                toggleText.textContent = "Don't have an account?";
                switchModeBtn.textContent = 'Sign up';
                document.getElementById('formTitle').textContent = 'Log in to Labh';
                document.getElementById('formSubtitle').textContent = 'Enter your details below to continue.';
                passwordInput.value = '';
            }, 2000);
        }
    }
});

// Clear inline errors as user types
[emailInput, passwordInput, nameInput].forEach(input => {
    input.addEventListener('input', () => {
        input.classList.remove('error-border');
        if (input.nextElementSibling) {
            input.nextElementSibling.classList.add('hidden');
        }
        errorDiv.classList.add('hidden');
    });
});

// On load, check for remembered email
document.addEventListener('DOMContentLoaded', () => {
    const rememberedEmail = localStorage.getItem('labh_remembered_email');
    if (rememberedEmail) {
        emailInput.value = rememberedEmail;
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        
        // Trigger input event to update avatar
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
});
