import React, { useState, useEffect } from 'react';
import { X, Database, RefreshCw, Activity, CheckCircle, Clock, Search, Shield } from 'lucide-react';

export default function ActivityLogDrawer({ isOpen, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
      const interval = setInterval(fetchActivities, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredActivities = activities.filter(act => {
    const matchesSearch = 
      (act.description && act.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.activity_type && act.activity_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (act.user_name && act.user_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'ALL' || act.activity_type === filterType;
    return matchesSearch && matchesType;
  });

  const getBadgeColor = (type) => {
    switch (type) {
      case 'USER_LOGIN': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'RENTAL_BOOKING': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'JOIN_TRIP': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'POST_TRIP': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'TOGGLE_BOOKMARK': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'SYSTEM_INIT': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                MySQL Activity Logger
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">LIVE</span>
              </h2>
              <p className="text-xs text-slate-400">Database Table: `user_activities`</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchActivities}
              disabled={loading}
              className={`p-2 rounded-full hover:bg-slate-800 text-slate-300 transition-transform ${loading ? 'animate-spin' : ''}`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Config Banner */}
        <div className="bg-slate-800 px-4 py-2.5 text-xs text-slate-300 border-b border-slate-700 flex items-center justify-between font-mono">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Host: localhost:3306</span>
          </div>
          <span className="text-indigo-300">DB: travelappgim</span>
        </div>

        {/* Filters & Search */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, action, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
            {['ALL', 'RENTAL_BOOKING', 'JOIN_TRIP', 'POST_TRIP', 'USER_LOGIN', 'TOGGLE_BOOKMARK'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                  filterType === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No activity logs recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">Perform any action in the app to see live MySQL logs</p>
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div key={act.id} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono ${getBadgeColor(act.activity_type)}`}>
                    {act.activity_type}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-800 leading-snug">
                  {act.description}
                </p>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="font-medium text-slate-700">User: {act.user_name || 'Suraj K'}</span>
                  <span className="font-mono text-[10px] text-slate-400">ID: #{act.id}</span>
                </div>

                {act.details && (
                  <pre className="mt-1.5 p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto">
                    {act.details}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
