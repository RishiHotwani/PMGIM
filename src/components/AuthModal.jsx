import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose, currentUser, onLoginSuccess, onLogout }) {
  const { login, loginPhone, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginMode, setLoginMode] = useState('email'); // 'email' | 'phone'
  const [isVendorRole, setIsVendorRole] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    batch: 'PGDM 2026',
    section: 'Sec A'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isSignUp) {
        data = await signup({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          batch: formData.batch,
          section: formData.section,
          role: isVendorRole ? 'VENDOR' : 'USER'
        });
      } else if (loginMode === 'phone') {
        data = await loginPhone(formData.phone, formData.password);
      } else {
        data = await login(formData.email, formData.password);
      }

      if (onLoginSuccess && data?.user) {
        onLoginSuccess(data.user);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {currentUser ? (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 shadow-lg shadow-blue-500/30">
              {currentUser.avatar || (currentUser.name ? currentUser.name[0] : 'US')}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{currentUser.name}</h3>
            <p className="text-sm text-slate-500">{currentUser.email}</p>
            {currentUser.phone_number && (
              <p className="text-xs text-slate-400 mt-0.5">📱 {currentUser.phone_number}</p>
            )}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Role: {currentUser.role}</span>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
              <button
                onClick={onLogout}
                className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-semibold hover:bg-red-100 transition-colors"
              >
                Log Out Session
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-center">
              <h2 className="text-2xl font-bold text-slate-900">
                {isSignUp ? 'Join GIM Campus' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isSignUp ? 'Create your student or vendor account' : 'Sign in with your GIM email or phone number'}
              </p>
            </div>

            {/* Login Mode Toggle Tab (Email vs Phone) */}
            {!isSignUp && (
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setLoginMode('email'); setError(''); }}
                  className={`flex-1 py-2 rounded-xl transition-all ${loginMode === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  ✉️ Email Login
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('phone'); setError(''); }}
                  className={`flex-1 py-2 rounded-xl transition-all ${loginMode === 'phone' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  📱 Phone Login
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Suraj K"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {(isSignUp || loginMode === 'email') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">GIM Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required={!isSignUp && loginMode === 'email'}
                      placeholder="vendor@gim.ac.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {(isSignUp || loginMode === 'phone') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required={!isSignUp && loginMode === 'phone'}
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {isSignUp && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      checked={isVendorRole}
                      onChange={(e) => setIsVendorRole(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Register as Campus Rental Vendor</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : isSignUp ? 'Create Account & Store Credentials' : `Sign In with ${loginMode === 'phone' ? 'Phone' : 'Email'}`}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
