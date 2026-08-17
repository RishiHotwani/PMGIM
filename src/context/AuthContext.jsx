import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveUserSession = (user, accessToken) => {
    setCurrentUser(user);
    if (user) {
      try {
        localStorage.setItem('gim_user', JSON.stringify(user));
        if (accessToken) localStorage.setItem('gim_token', accessToken);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('gim_user');
        localStorage.removeItem('gim_token');
      } catch (e) {}
    }
  };

  const restoreSession = async () => {
    try {
      const storedToken = localStorage.getItem('gim_token');
      const headers = { 'Cache-Control': 'no-cache' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          saveUserSession(data.user, data.accessToken || storedToken);
          return;
        }
      }

      // Try refresh endpoint
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.user) {
          saveUserSession(refreshData.user, refreshData.accessToken);
          return;
        }
      }

      // Fallback to stored local user only if token still exists (prevents zombie login)
      const storedUser = localStorage.getItem('gim_user');
      if (storedUser && storedToken) {
        try {
          const userObj = JSON.parse(storedUser);
          setCurrentUser(userObj);
        } catch(e) {}
      } else if (!storedToken) {
        try { localStorage.removeItem('gim_user'); localStorage.removeItem('gim_token'); } catch(e){}
      }
    } catch (err) {
      console.warn('Session restore warning:', err.message);
      const token = (()=>{ try{return localStorage.getItem('gim_token');}catch(e){return null;}})();
      if (token) {
        try {
          const storedUser = localStorage.getItem('gim_user');
          if (storedUser) setCurrentUser(JSON.parse(storedUser));
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const safeParseJson = async (res, defaultErrorMsg) => {
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.warn('Non-JSON response received:', text);
    }
    if (!res.ok) {
      const serverMsg = data.message || data.error;
      if (serverMsg) {
        throw new Error(serverMsg);
      }
      throw new Error(`${defaultErrorMsg} (Server HTTP ${res.status})`);
    }
    return data;
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeParseJson(res, 'Login failed');
    saveUserSession(data.user, data.accessToken);
    return data;
  };

  const loginPhone = async (phone, password) => {
    const res = await fetch('/api/auth/login-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await safeParseJson(res, 'Phone login failed');
    saveUserSession(data.user, data.accessToken);
    return data;
  };

  const signup = async (userData) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await safeParseJson(res, 'Registration failed');
    saveUserSession(data.user, data.accessToken);
    return data;
  };

  const loginWithGoogleToken = async (credentialInput, desiredRole = 'USER') => {
    const payload = typeof credentialInput === 'string'
      ? { credential: credentialInput, role: desiredRole }
      : { ...credentialInput, role: desiredRole };

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await safeParseJson(res, 'Google authentication failed');
    saveUserSession(data.user, data.accessToken);
    return data;
  };

  const updateUserRole = async (newRole) => {
    const token = (()=>{ try{ return localStorage.getItem('gim_token'); }catch(e){ return null; } })();
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
      'x-user-name': currentUser?.name || 'User'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/auth/role', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role: newRole })
    });
    const data = await safeParseJson(res, 'Failed to update role');
    const updated = currentUser ? { ...currentUser, role: newRole } : null;
    saveUserSession(updated, localStorage.getItem('gim_token'));
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    saveUserSession(null, null);
  };

  const forgotPassword = async (email) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return await safeParseJson(res, 'Failed to send reset link');
  };

  const resetPassword = async (token, password) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    return await safeParseJson(res, 'Password reset failed');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        loginPhone,
        signup,
        loginWithGoogleToken,
        updateUserRole,
        logout,
        forgotPassword,
        resetPassword,
        setCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
