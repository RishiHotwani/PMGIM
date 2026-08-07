import React from 'react';
import { Home, Bike, Compass, Users, User } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rentals', label: 'Rentals', icon: Bike },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'travel', label: 'Travel', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto bg-slate-950/80 backdrop-blur-2xl border border-white/15 rounded-full p-2 shadow-2xl shadow-slate-950/60 flex items-center justify-around transition-all duration-300">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-90 ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-2 rounded-full transition-all duration-300 flex items-center gap-1.5 ${
                isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 shadow-lg shadow-blue-500/40 scale-105 border border-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              {isActive && (
                <span className="text-[11px] font-black tracking-wide animate-fadeIn">
                  {item.label}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
