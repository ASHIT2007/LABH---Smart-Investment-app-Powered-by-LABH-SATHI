import { apiCall, setAuthUser, getAuthUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    if (getAuthUser()) {
        window.location.href = 'index.html';
    }

    const loginTabBtn = document.getElementById('loginTabBtn');
    const regTabBtn = document.getElementById('regTabBtn');
    const regFields = document.getElementById('regFields');
    const authForm = document.getElementById('authForm');
    const submitBtn = document.getElementById('submitBtn');
    const authError = document.getElementById('authError');
    const tabIdx = document.getElementById('tabIdx');

    let currentMode = 'login'; // 'login' or 'register'

    function switchTab(mode) {
        currentMode = mode;
        authError.textContent = '';
        if (mode === 'login') {
            loginTabBtn.classList.add('active');
            regTabBtn.classList.remove('active');
            regFields.classList.add('hidden');
            submitBtn.textContent = 'Sign In';
            tabIdx.style.transform = 'translateX(0)';
        } else {
            regTabBtn.classList.add('active');
            loginTabBtn.classList.remove('active');
            regFields.classList.remove('hidden');
            submitBtn.textContent = 'Create Account';
            tabIdx.style.transform = 'translateX(100%)';
        }
    }

    loginTabBtn.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });
    regTabBtn.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('regName')?.value;
        const level = document.getElementById('regLevel')?.value;
        
        authError.textContent = '';
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            const endpoint = currentMode === 'login' ? '/auth/login' : '/auth/register';
            const body = currentMode === 'login' 
                ? { email, password } 
                : { email, password, name, level };

            const data = await apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            setAuthUser(data.user);
            window.location.href = 'index.html';
        } catch (err) {
            authError.textContent = err.message;
            submitBtn.textContent = currentMode === 'login' ? 'Sign In' : 'Create Account';
            submitBtn.disabled = false;
        }
    });
});
