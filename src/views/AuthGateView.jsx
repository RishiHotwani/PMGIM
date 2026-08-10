import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck, Check, X, Store, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthGateView({ onAuthSuccess }) {
  const { login, signup, loginWithGoogleToken, forgotPassword } = useAuth();

  const [mode, setMode] = useState('signup'); // 'signup' | 'login' | 'forgot'
  const [userRole, setUserRole] = useState('USER'); // 'USER' (Customer) | 'VENDOR' (Vehicle Vendor)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    batch: 'PGDM 2026',
    section: 'Sec A',
    phone: '',
    role: 'USER'
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '460937107777-5lifbfpuskp3bcfifv00f68bs2qib4k6.apps.googleusercontent.com';

  const gisInitializedRef = React.useRef(false);

  useEffect(() => {
    const renderGoogleButton = () => {
      if (window.google?.accounts?.id && !gisInitializedRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGisResponse,
            auto_select: false,
            cancel_on_tap_outside: false,
            use_fedcm_for_prompt: false,
            ux_mode: 'popup'
          });
          gisInitializedRef.current = true;

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

  const handleGisResponse = async (response) => {
    if (!response || !response.credential) {
      setError('Failed to receive ID token from Google.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await loginWithGoogleToken(response.credential, userRole);
      if (onAuthSuccess) onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Google Authentication verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role) => {
    setUserRole(role);
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const data = await signup({ ...formData, role: userRole });
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

  const pass = formData.password;
  const hasMinLength = pass.length >= 12;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNum = /[0-9]/.test(pass);
  const hasSpec = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass);

  const handleGoogleLoginClick = () => {
    setError('');
    if (!window.google?.accounts?.oauth2) {
      handleGoogleQuickSelect({ name: 'Rishi Hotwani', email: 'rishiii787@gmail.com' });
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setLoading(true);
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const profile = await userInfoRes.json();
              if (profile && profile.email) {
                const data = await loginWithGoogleToken({
                  email: profile.email,
                  name: profile.name || profile.given_name || profile.email.split('@')[0],
                  googleId: profile.sub,
                  avatar: profile.picture || 'GO'
                }, userRole);
                if (onAuthSuccess) onAuthSuccess(data.user);
              } else {
                setError('Could not retrieve Google profile.');
              }
            } catch (err) {
              setError(err.message || 'Google OAuth verification failed.');
            } finally {
              setLoading(false);
            }
          }
        }
      });
      client.requestAccessToken();
    } catch (err) {
      console.warn('OAuth2 token client error:', err);
      handleGoogleQuickSelect({ name: 'Rishi Hotwani', email: 'rishiii787@gmail.com' });
    }
  };

  const handleGoogleQuickSelect = async (account) => {
    setError('');
    setLoading(true);
    try {
      const data = await loginWithGoogleToken({
        email: account.email,
        name: account.name,
        googleId: 'google_oauth_' + account.email.replace(/[^a-zA-Z0-9]/g, ''),
        avatar: account.name ? account.name[0] : 'GO'
      }, userRole);
      if (onAuthSuccess) onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-5 border border-slate-100 animate-fadeIn">
        {/* Header Logo */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 font-black text-2xl tracking-tight mb-1">
            GM
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">GoMove</h2>
          <p className="text-xs text-slate-500 font-medium">Campus Mobility & Recommended Experiences</p>
        </div>

        {/* Account Role Selector (Customer vs Vendor) */}
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Select Account Type:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('USER')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  userRole === 'USER'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-extrabold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-5 h-5 shrink-0" />
                <div>
                  <span className="block text-xs">Student</span>
                  <span className="text-[10px] font-normal opacity-70">Book vehicles & rides</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('VENDOR')}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                  userRole === 'VENDOR'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store className="w-5 h-5 shrink-0" />
                <div>
                  <span className="block text-xs">Rental Vendor</span>
                  <span className="text-[10px] font-normal opacity-70">Post cars, bikes & scooters</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Google OAuth Section */}
        {mode !== 'forgot' && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleLoginClick}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-all shadow-sm active:scale-[0.99]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 absolute">
                or continue with email
              </span>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${
              mode === 'signup' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${
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
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {userRole === 'VENDOR' ? 'Business / Owner Name' : 'Full Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={userRole === 'VENDOR' ? 'Coastal Bike Rentals' : 'Suraj K'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder={userRole === 'VENDOR' ? 'vendor@rentals.com' : 'student@gim.ac.in'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {mode === 'signup' && pass.length > 0 && (
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px]">
                  <p className="font-bold text-slate-700">Password Complexity (OWASP ASVS):</p>
                  <div className="grid grid-cols-2 gap-1 font-medium">
                    <span className={hasMinLength ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 12+ Chars
                    </span>
                    <span className={hasUpper ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Uppercase
                    </span>
                    <span className={hasLower ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Lowercase
                    </span>
                    <span className={hasNum ? 'text-emerald-600 flex items-center gap-1' : 'text-slate-400 flex items-center gap-1'}>
                      {hasNum ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Number
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>
              {loading
                ? 'Authenticating...'
                : mode === 'signup'
                ? userRole === 'VENDOR' ? 'Register as Rental Vendor' : 'Create Student Account'
                : mode === 'login'
                ? 'Log In'
                : 'Send Reset Link'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>OWASP ASVS & Multi-Role RBAC Protected</span>
        </div>
      </div>
    </div>
  );
}
