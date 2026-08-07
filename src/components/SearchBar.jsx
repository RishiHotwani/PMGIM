import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ placeholder = "Where do you want to go today?", value, onChange, onFocus }) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-3.5 bg-slate-100/80 border border-slate-200/60 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-500 transition-all shadow-sm"
      />
    </div>
  );
}
