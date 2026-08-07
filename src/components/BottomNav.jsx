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
    <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto bg-white/80 backdrop-blur-2xl border border-white/80 rounded-full p-2 shadow-2xl shadow-slate-900/10 flex items-center justify-around transition-all duration-300">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-90 ${
              isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div
              className={`p-2 rounded-full transition-all duration-300 flex items-center gap-1.5 ${
                isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 shadow-lg shadow-blue-500/30 scale-105 border border-white/40' : 'hover:bg-slate-100/80'
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
