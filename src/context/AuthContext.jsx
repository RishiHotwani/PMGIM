import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silent session restore via /api/auth/me or /api/auth/refresh on initial load
  const restoreSession = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          return;
        }
      }
      // If access token expired, attempt silent refresh via HttpOnly cookie
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.user) {
          setCurrentUser(refreshData.user);
        }
      }
    } catch (err) {
      console.warn('Session restore warning:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    setCurrentUser(data.user);
    return data;
  };

  const signup = async (userData) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    setCurrentUser(data.user);
    return data;
  };

  const loginWithGoogleToken = async (credentialToken, desiredRole = 'USER') => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialToken, role: desiredRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Google authentication failed');
    setCurrentUser(data.user);
    return data;
  };

  const updateUserRole = async (newRole) => {
    const res = await fetch('/api/auth/role', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || ''
      },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update role');
    setCurrentUser((prev) => (prev ? { ...prev, role: newRole } : null));
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setCurrentUser(null);
    }
  };

  const forgotPassword = async (email) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send reset link');
    return data;
  };

  const resetPassword = async (token, password) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Password reset failed');
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
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
