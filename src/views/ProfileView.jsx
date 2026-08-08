import React, { useState, useEffect } from 'react';
import { User, Mail, Bookmark, LogOut, Phone, ShieldCheck } from 'lucide-react';
import SpotDetailModal from '../components/SpotDetailModal';
import UserAvatar from '../components/UserAvatar';

export default function ProfileView({ currentUser, onLogout, onLogAction, places = [] }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState(null);

  // Sync bookmarks from places prop (real-time single source of truth)
  useEffect(() => {
    if (places && places.length > 0) {
      const saved = places.filter((p) => Boolean(p.is_bookmarked));
      setBookmarks(saved);
      setLoading(false);
    }
  }, [places]);

  const fetchPrivateBookmarks = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/bookmarks', {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.name || 'User'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch (err) {
      console.error('Fetch bookmarks error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchPrivateBookmarks();
    }
  }, [currentUser]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-24 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">Student Account & Profile</h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Manage your credentials & saved private bookmarks</p>
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
              <UserAvatar user={currentUser} className="w-16 h-16 text-2xl" />
              <div>
                <h2 className="text-lg font-black">{currentUser?.name || 'GIM Student'}</h2>
                <p className="text-xs text-blue-100 font-medium">{currentUser?.email}</p>
                <span className="inline-block px-2.5 py-0.5 mt-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-extrabold tracking-wide">
                  {currentUser?.role || 'Student'}
                </span>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Account Information</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Name</span>
                <span className="font-bold text-slate-800">{currentUser?.name}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Email</span>
                <span className="font-bold text-slate-800">{currentUser?.email}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Account Type</span>
                <span className="font-bold text-blue-600 uppercase">{currentUser?.role || 'USER'}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Auth Method</span>
                <span className="font-bold text-slate-800">{currentUser?.google_id ? 'Google OAuth 2.0' : 'Email Password'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Private Bookmarks */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-blue-600" />
              Private Saved Bookmarks ({bookmarks.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400">Loading your saved spots...</div>
          ) : bookmarks.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 text-center text-xs text-slate-500 space-y-2">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No private bookmarks saved yet</p>
              <p>Tap the heart icon on any spot in Explore Goa to save it here privately!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bookmarks.map(place => (
                <div
                  key={place.id}
                  onClick={() => setSelectedSpot(place)}
                  className="p-4 bg-white rounded-3xl border border-slate-100 shadow-md flex items-center gap-4 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <img src={place.image} alt={place.name} className="w-16 h-16 rounded-2xl object-cover group-hover:scale-105 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">{place.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{place.category} • {place.distance}</p>
                    <span className="inline-block text-xs font-bold text-amber-500 mt-1">★ {place.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spot Detail Modal in Profile View */}
      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          currentUser={currentUser}
          onLogAction={onLogAction}
        />
      )}
    </div>
  );
}
