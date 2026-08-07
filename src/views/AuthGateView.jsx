import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthGateView({ onAuthSuccess }) {
  const { login, signup, loginWithGoogleToken, forgotPassword } = useAuth();

  const [mode, setMode] = useState('signup'); // 'signup' | 'login' | 'forgot'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    batch: 'PGDM 2026',
    section: 'Sec A',
    phone: ''
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '460937107777-5lifbfpuskp3bcfifv00f68bs2qib4k6.apps.googleusercontent.com';

  // Initialize Official Google Identity Services (GIS) SDK
  useEffect(() => {
    const renderGoogleButton = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGisResponse,
            auto_select: false,
            cancel_on_tap_outside: false
          });

          const btnContainer = document.getElementById('official-google-btn');
          if (btnContainer) {
            btnContainer.innerHTML = '';
            window.google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              width: 340,
              text: 'continue_with',
              shape: 'pill'
            });
          }
        } catch (err) {
          console.warn('GIS initialization error:', err);
        }
      }
    };

    const timer = setTimeout(renderGoogleButton, 300);
    return () => clearTimeout(timer);
  }, [GOOGLE_CLIENT_ID, mode]);

  // Official Google OAuth Token Callback Handler
  const handleGisResponse = async (response) => {
    if (!response || !response.credential) {
      setError('Failed to receive ID token from Google.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Sends real Google ID Token to backend for server-side verification via OAuth2Client.verifyIdToken
      const data = await loginWithGoogleToken(response.credential);
      if (onAuthSuccess) onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Google Authentication verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const data = await signup(formData);
        if (onAuthSuccess) onAuthSuccess(data.user);
      } else if (mode === 'login') {
        const data = await login(formData.email, formData.password);
        if (onAuthSuccess) onAuthSuccess(data.user);
      } else if (mode === 'forgot') {
        const data = await forgotPassword(formData.email);
        setSuccessMsg(data.message || 'Password reset instructions have been sent.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Password Complexity Evaluator
  const pass = formData.password;
  const hasMinLength = pass.length >= 12;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNum = /[0-9]/.test(pass);
  const hasSpec = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass);

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 border border-slate-100 animate-fadeIn">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-blue-500/30">
            GIM
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            PMGIM <span className="text-blue-600">Travel</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Goa Institute of Management • Enterprise Authenticated Platform
          </p>
        </div>

        {/* Official Google OAuth Section */}
        {mode !== 'forgot' && (
          <div className="space-y-3">
            <div className="flex justify-center w-full min-h-[44px]">
              <div id="official-google-btn" className="w-full flex justify-center" />
            </div>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 absolute">
                or continue with email
              </span>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              mode === 'signup' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              mode === 'login' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'
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

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold leading-relaxed">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Suraj K"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">GIM Email Address</label>
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

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Password Strength Rules for Signup */}
              {mode === 'signup' && pass.length > 0 && (
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                  <p className="font-bold text-slate-700">Password Complexity (OWASP ASVS):</p>
                  <div className="grid grid-cols-2 gap-1 font-medium">
                    <span className={hasMinLength ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 12+ Characters
                    </span>
                    <span className={hasUpper ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Uppercase (A-Z)
                    </span>
                    <span className={hasLower ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Lowercase (a-z)
                    </span>
                    <span className={hasNum ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasNum ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Number (0-9)
                    </span>
                    <span className={hasSpec ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'} style={{ gridColumn: 'span 2' }}>
                      {hasSpec ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Special Symbol (!@#$%^&*)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'signup' && (
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
            <span>
              {loading
                ? 'Authenticating...'
                : mode === 'signup'
                ? 'Create Secure Account'
                : mode === 'login'
                ? 'Log In'
                : 'Send Password Reset Link'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>OWASP ASVS & bcrypt (cost 12) Protected</span>
        </div>
      </div>
    </div>
  );
}
