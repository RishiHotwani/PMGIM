import React, { useState, useEffect } from 'react';
import { Bell, LogOut, Compass, Bike, Users, Home, User, Store, Check, Sparkles, Inbox } from 'lucide-react';

export default function Header({ currentUser, onLogout, activeTab, setActiveTab }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const isVendor = currentUser?.role === 'VENDOR' || currentUser?.role === 'ADMIN';

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rentals', label: 'Rentals', icon: Bike },
    ...(isVendor ? [{ id: 'vendor_portal', label: 'Vendor Portal', icon: Store }] : []),
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
    <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-12 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Greeting */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 group text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
              GIM
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base md:text-lg leading-tight tracking-tight block">
                PMGIM <span className="text-blue-600">Travel</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 block -mt-0.5">
                Goa Campus Mobility
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
            <span className="text-xs text-slate-400 font-medium">Welcome,</span>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              {firstName} 👋 {isVendor && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-md">Vendor</span>}
            </span>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4 stroke-[2.2]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 relative">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold ring-2 ring-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-fadeIn space-y-3">
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
                  /* Glassmorphic Default Value of No Activity Yet */
                  <div className="p-6 bg-slate-900/5 backdrop-blur-md rounded-2xl border border-white/40 text-center space-y-2 my-2">
                    <Inbox className="w-8 h-8 text-slate-400 mx-auto stroke-[1.5]" />
                    <p className="font-extrabold text-xs text-slate-800">No Activity Yet</p>
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
            className="flex items-center gap-2 p-1 pr-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 transition-colors"
            title={`${currentUser?.name} (${currentUser?.role})`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {currentUser?.avatar || 'US'}
            </div>
            <span className="hidden lg:inline text-xs font-bold text-slate-800">
              {firstName}
            </span>
          </button>

          {/* Log Out Button */}
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
