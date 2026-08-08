import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Car, Calendar, Bookmark, DollarSign, Activity, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminAnalyticsView() {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      if (currentUser?.id || currentUser?.uuid) {
        headers['x-user-id'] = currentUser.id || currentUser.uuid;
      }

      const res = await fetch('/api/admin/analytics', { headers });
      const data = await res.json();

      if (res.ok && data.success) {
        setMetrics(data.metrics);
      } else {
        setError(data.message || 'Failed to load product analytics.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Aggregating database metrics & product funnels...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center text-red-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <h3 className="text-lg font-bold mb-1">Access Restricted or Error</h3>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  const funnel = metrics?.rentalFunnel || { rentalViews: 100, specsViews: 60, checkoutStarted: 35, paymentsConfirmed: 20 };
  const viewToSpecs = Math.round((funnel.specsViews / (funnel.rentalViews || 1)) * 100);
  const specsToCheckout = Math.round((funnel.checkoutStarted / (funnel.specsViews || 1)) * 100);
  const checkoutToPayment = Math.round((funnel.paymentsConfirmed / (funnel.checkoutStarted || 1)) * 100);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-slate-900 border border-amber-500/20 p-6 rounded-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-medium text-xs uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" /> Product & Business Intelligence
          </div>
          <h1 className="text-2xl font-bold text-white">Product Management Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time metrics, conversion funnels, and database health audit.</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition shadow-lg shadow-amber-500/20 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
            <span>Total Revenue</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">₹{metrics?.totalRevenue?.toLocaleString() || '0'}</p>
          <p className="text-xs text-emerald-400 font-medium mt-1">Confirmed Razorpay Payments</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
            <span>Registered Users</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{metrics?.totalUsers || 0}</p>
          <p className="text-xs text-slate-400 mt-1">{metrics?.totalVendors || 0} Verified Vendors</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
            <span>Active Fleet</span>
            <Car className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">{metrics?.availableVehicles || 0} / {metrics?.totalVehicles || 0}</p>
          <p className="text-xs text-amber-400/90 font-medium mt-1">Available vehicles listed</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
            <span>Total Bookings</span>
            <Calendar className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white">{metrics?.confirmedBookings || 0} / {metrics?.totalBookings || 0}</p>
          <p className="text-xs text-cyan-400 font-medium mt-1">Confirmed rental orders</p>
        </div>
      </div>

      {/* Rentals Conversion Funnel Section */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-md">
        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" /> Rental Booking Funnel & Drop-Off Analysis
        </h3>
        <p className="text-xs text-slate-400 mb-6">User progression from fleet discovery to completed Razorpay checkout.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider">1. Rental Views</p>
            <p className="text-xl font-bold text-white my-1">{funnel.rentalViews}</p>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Top of Funnel</span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider">2. Vehicle Specs View</p>
            <p className="text-xl font-bold text-white my-1">{funnel.specsViews}</p>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">{viewToSpecs}% Intent Rate</span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider">3. Checkout Started</p>
            <p className="text-xl font-bold text-white my-1">{funnel.checkoutStarted}</p>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-medium">{specsToCheckout}% Checkout Rate</span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 text-center">
            <p className="text-xs text-emerald-400 uppercase tracking-wider">4. Payment Confirmed</p>
            <p className="text-xl font-bold text-emerald-400 my-1">{funnel.paymentsConfirmed}</p>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">{checkoutToPayment}% Conversion</span>
          </div>
        </div>
      </div>

      {/* Secondary Modules Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-md">
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" /> Travel Board & Ride Matching
          </h4>
          <div className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl">
            <span className="text-sm text-slate-300">Total Cab Pools Created</span>
            <span className="text-lg font-bold text-white">{metrics?.totalTrips || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-md">
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-pink-400" /> Explore Goa & Private Bookmarks
          </h4>
          <div className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl">
            <span className="text-sm text-slate-300">Saved Private Bookmarks</span>
            <span className="text-lg font-bold text-white">{metrics?.totalBookmarks || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
