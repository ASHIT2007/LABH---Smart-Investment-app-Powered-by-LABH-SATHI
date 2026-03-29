// API Config
const API_URL = '/api';

export const apiCall = async (endpoint, options = {}) => {
    try {
        const url = `${API_URL}${endpoint}`;
        const defaultHeaders = { 'Content-Type': 'application/json' };
        
        const res = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'API Error');
        return data;
    } catch (err) {
        console.error('API Call Failed:', err);
        throw err;
    }
};

// Auth Store
export const getAuthUser = () => {
    const userStr = localStorage.getItem('labh_user');
    return userStr ? JSON.parse(userStr) : null;
};

export const setAuthUser = (user) => {
    localStorage.setItem('labh_user', JSON.stringify(user));
};

export const logout = () => {
    localStorage.removeItem('labh_user');
    window.location.href = 'login.html';
};
