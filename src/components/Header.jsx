import React, { useState, useEffect } from 'react';
import { Bell, LogOut, Compass, Bike, Users, Home, User, Store, Check, Sparkles, Inbox, BarChart3 } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function Header({ currentUser, onLogout, activeTab, setActiveTab }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const isVendor = currentUser?.role === 'VENDOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rentals', label: 'Rentals', icon: Bike },
    ...(isVendor ? [{ id: 'vendor_portal', label: 'Vendor Portal', icon: Store }] : []),
    ...(isVendor ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    { id: 'explore', label: 'Explore Goa', icon: Compass },
    { id: 'travel', label: 'Travel Board', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'User'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'User'
        }
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Student';

  return (
    <header className="w-full bg-white/70 backdrop-blur-2xl border-b border-white/80 sticky top-0 z-30 shadow-md shadow-slate-900/5 transition-all duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-12 py-3 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Greeting */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 group text-left focus:outline-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/25 group-hover:scale-105 group-active:scale-95 transition-all duration-300 border border-white/40">
              GM
            </div>
            <div>
              <span className="font-black text-slate-900 text-lg tracking-tight block leading-tight">
                Go<span className="text-blue-600">Move</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 block -mt-0.5 tracking-wide uppercase">
                Campus Mobility
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200/80">
            <span className="text-xs text-slate-400 font-medium">Welcome,</span>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              {firstName} 👋 {isVendor && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black rounded-md uppercase tracking-wider">Vendor</span>}
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links (Transparent White Glass Segmented Pills) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-200/50 backdrop-blur-xl p-1.5 rounded-full border border-white/80 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all duration-300 ${
                  isActive
                    ? 'bg-white text-blue-600 font-black shadow-md shadow-slate-300/50 scale-105 border border-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'stroke-[2]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 relative">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 shadow-xs backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black ring-2 ring-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/80 p-4 z-50 animate-fadeIn space-y-3 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h4 className="font-black text-xs text-slate-900">Activity & Updates</h4>
                  </div>
                  {notifications.length > 0 && unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Mark read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="p-6 bg-slate-900/5 backdrop-blur-md rounded-2xl border border-slate-200/50 text-center space-y-2 my-2">
                    <Inbox className="w-8 h-8 text-slate-400 mx-auto stroke-[1.5]" />
                    <p className="font-black text-xs text-slate-800">No Activity Yet</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      You will get live alerts when Vendors list vehicles, students join your rides, or reviews are posted!
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-2xl text-xs space-y-1 transition-colors ${
                          n.is_read ? 'bg-slate-50 text-slate-600' : 'bg-blue-50/80 border border-blue-200/60 text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs">{n.title}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 p-1 pr-2.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/70 shadow-xs backdrop-blur-md transition-all active:scale-95"
            title={`${currentUser?.name} (${currentUser?.role})`}
          >
            <UserAvatar user={currentUser} className="w-8 h-8 text-xs" />
            <span className="hidden lg:inline text-xs font-extrabold text-slate-800">
              {firstName}
            </span>
          </button>

          {/* Log Out Button */}
          <button
            onClick={onLogout}
            className="p-2.5 rounded-2xl bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200/70 shadow-xs backdrop-blur-md transition-all active:scale-95"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
