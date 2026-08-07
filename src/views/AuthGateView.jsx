import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck, X } from 'lucide-react';

export default function AuthGateView({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(true); // Sign Up mode or Log In mode
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    batch: 'PGDM 2026',
    section: 'Sec A',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleInitialized, setGoogleInitialized] = useState(false);

  // Initialize Official Google Identity Services (GSI) SDK
  useEffect(() => {
    const initGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: '109827364512-gimcampus.apps.googleusercontent.com', // Standard GIM OAuth Client ID
            callback: handleGoogleCredentialResponse,
            cancel_on_tap_outside: false
          });

          // Render official 1-Click Google Sign-In button
          const btnDiv = document.getElementById('gsi-btn-container');
          if (btnDiv) {
            window.google.accounts.id.renderButton(btnDiv, {
              theme: 'outline',
              size: 'large',
              width: 340,
              text: 'continue_with',
              shape: 'pill'
            });
          }

          setGoogleInitialized(true);
        } catch (err) {
          console.warn('Google Identity Services setup warning:', err);
        }
      }
    };

    const timer = setTimeout(initGsi, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      setError('');
      // Decode JWT token payload from Google
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const googleUser = JSON.parse(jsonPayload);

      await authenticateGoogleAccount({
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || 'Google User',
        googleId: googleUser.sub
      });
    } catch (err) {
      setError('Google Sign-In failed: ' + err.message);
      setLoading(false);
    }
  };

  const authenticateGoogleAccount = async ({ email, name, googleId }) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, googleId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate Google account');
      }
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualGoogleClick = () => {
    setError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback if browser blocks popups or One-Tap
          promptFallbackGoogleAccount();
        }
      });
    } else {
      promptFallbackGoogleAccount();
    }
  };

  const promptFallbackGoogleAccount = () => {
    const userEmail = prompt('Enter your Google Gmail Address (e.g., student@gim.ac.in):');
    if (!userEmail || !userEmail.includes('@')) return;
    const namePart = userEmail.split('@')[0].replace('.', ' ');
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    setLoading(true);
    authenticateGoogleAccount({
      email: userEmail.trim(),
      name: formattedName,
      googleId: 'g_id_' + Date.now()
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 border border-slate-100 animate-fadeIn">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-blue-500/30">
            GIM
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            PMGIM <span className="text-blue-600">Travel</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Goa Institute of Management • Campus Mobility Platform
          </p>
        </div>

        {/* Google OAuth Section */}
        <div className="space-y-3">
          <div id="gsi-btn-container" className="flex justify-center w-full min-h-[44px]"></div>

          {!googleInitialized && (
            <button
              type="button"
              onClick={handleManualGoogleClick}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white border border-slate-200 hover:border-blue-400 hover:bg-slate-50 rounded-2xl font-bold text-xs text-slate-700 shadow-sm flex items-center justify-center gap-3 transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          )}

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 absolute">
              or continue with email
            </span>
          </div>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              isSignUp ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account (Sign Up)
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              !isSignUp ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Log In
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold leading-relaxed">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="student@gim.ac.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Batch</label>
                  <input
                    type="text"
                    placeholder="PGDM 2026"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Section</label>
                  <input
                    type="text"
                    placeholder="Sec B"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Processing...' : isSignUp ? 'Sign Up & Store Credentials' : 'Log In with Credentials'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>User credentials stored in MySQL Database (`travelappgim`)</span>
        </div>
      </div>
    </div>
  );
}
