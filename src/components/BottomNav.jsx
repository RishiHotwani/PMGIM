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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div
              className={`p-1.5 rounded-full transition-all duration-200 ${
                isActive ? 'bg-blue-50 text-blue-600 px-4' : ''
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className={`text-[11px] font-medium mt-0.5 ${isActive ? 'font-bold text-blue-600' : ''}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
