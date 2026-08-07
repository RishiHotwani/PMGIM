import React from 'react';
import { Bell, LogOut, Compass, Bike, Users, Home, User, Store } from 'lucide-react';

export default function Header({ currentUser, onLogout, activeTab, setActiveTab }) {
  const isVendor = currentUser?.role === 'VENDOR' || currentUser?.role === 'ADMIN';

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rentals', label: 'Rentals', icon: Bike },
    ...(isVendor ? [{ id: 'vendor_portal', label: 'Vendor Portal', icon: Store }] : []),
    { id: 'explore', label: 'Explore Goa', icon: Compass },
    { id: 'travel', label: 'Travel Board', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
  ];

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
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Notification Bell */}
          <button className="relative p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white"></span>
          </button>

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
