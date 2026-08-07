import React from 'react';
import { User, Mail, Bookmark, LogOut, Phone, Layers } from 'lucide-react';

export default function ProfileView({ currentUser, onLogout, places }) {
  const bookmarkedPlaces = (places || []).filter(p => p.is_bookmarked);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">Student Account & Profile</h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Manage your GIM credentials & saved campus bookmarks</p>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-2xl text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: User Profile Card */}
        <div className="space-y-6 lg:col-span-1">
          {/* User Card */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 text-white rounded-3xl p-6 shadow-xl shadow-blue-500/20 relative overflow-hidden">
            <div className="flex items-center gap-4 z-10 relative">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white font-black text-2xl flex items-center justify-center border border-white/30 shadow-inner">
                {currentUser ? currentUser.avatar : 'US'}
              </div>
              <div>
                <h2 className="text-xl font-bold">{currentUser ? currentUser.name : 'Student User'}</h2>
                <p className="text-xs text-blue-100 mt-0.5">{currentUser ? currentUser.email : 'student@gim.ac.in'}</p>
                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-white">
                  <span>{currentUser ? currentUser.batch : 'PGDM 2026'}</span>
                  <span>•</span>
                  <span>{currentUser ? currentUser.section : 'Sec A'}</span>
                </div>
              </div>
            </div>

            {/* Decorative Circle */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full border-8 border-white/10 pointer-events-none" />
          </div>

          {/* User Details Details Box */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 card-shadow space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">Student Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Full Name</span>
                <span className="font-bold text-slate-800">{currentUser?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">GIM Email</span>
                <span className="font-bold text-slate-800">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Batch & Section</span>
                <span className="font-bold text-slate-800">{currentUser?.batch} ({currentUser?.section})</span>
              </div>
              {currentUser?.phone && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-bold text-slate-800">{currentUser?.phone}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Auth Method</span>
                <span className="font-bold text-blue-600">
                  {currentUser?.auth_method === 'google' ? 'Google OAuth 2.0' : 'Email & Password'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Bookmarked Places */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-600" />
              Saved Bookmarks ({bookmarkedPlaces.length})
            </h3>
          </div>

          {bookmarkedPlaces.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No bookmarked spots yet</p>
              <p>Tap the bookmark icon on any spot in Explore Goa to save it here for quick access!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bookmarkedPlaces.map(place => (
                <div key={place.id} className="p-4 bg-white rounded-3xl border border-slate-100 card-shadow flex items-center gap-4 hover:border-blue-200 transition-all">
                  <img src={place.image} alt={place.name} className="w-16 h-16 rounded-2xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-slate-900 text-sm truncate">{place.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{place.category} • {place.distance}</p>
                    <span className="inline-block text-xs font-bold text-blue-600 mt-1">★ {place.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
