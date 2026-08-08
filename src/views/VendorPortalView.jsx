import React, { useState, useEffect } from 'react';
import { PlusCircle, Bike, Car, Shield, Trash2, CheckCircle2, XCircle, DollarSign, MapPin, Tag } from 'lucide-react';

export default function VendorPortalView({ currentUser, onRefreshRentals }) {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    category: 'Bike',
    price_per_day: '',
    fuel: 'Petrol',
    transmission: 'Manual',
    tags: 'Verified Vendor',
    image: '',
    description: '',
    location: 'Sanquelim / Campus Gate'
  });

  const getAuthHeaders = () => ({
    'x-user-id': currentUser?.id || '',
    'x-user-name': currentUser?.name || 'Vendor'
  });

  const fetchMyFleet = async () => {
    try {
      const res = await fetch('/api/rentals/vendor', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFleet(data);
      }
    } catch (err) {
      console.error('Fetch fleet error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyFleet();
  }, [currentUser]);

  const handlePostVehicle = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to post vehicle');

      setMsg(data.message);
      setShowAddModal(false);
      setFormData({
        title: '',
        category: 'Bike',
        price_per_day: '',
        fuel: 'Petrol',
        transmission: 'Manual',
        tags: 'Verified Vendor',
        image: '',
        description: '',
        location: 'Sanquelim / Campus Gate'
      });
      fetchMyFleet();
      if (onRefreshRentals) onRefreshRentals();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await fetch(`/api/rentals/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      fetchMyFleet();
      if (onRefreshRentals) onRefreshRentals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vehicle listing?')) return;
    try {
      await fetch(`/api/rentals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      fetchMyFleet();
      if (onRefreshRentals) onRefreshRentals();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Vendor Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <Shield className="w-3.5 h-3.5" />
            <span>Verified Rental Vendor Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Welcome, <span className="text-blue-400">{currentUser?.name || 'Vendor'}</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Manage your rental fleet across GIM campus and Sanquelim. List new Cars, Bikes, or Scooters and control live daily pricing.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-3 px-6 bg-blue-600 hover:bg-blue-500 font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add New Vehicle</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{msg}</span>
        </div>
      )}

      {/* Fleet Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Fleet</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{fleet.length} Vehicles</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Bike className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available for Rent</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {fleet.filter(f => f.is_available).length} Live
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Daily Rate</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              ₹{fleet.length ? Math.round(fleet.reduce((acc, curr) => acc + curr.price_per_day, 0) / fleet.length) : 0}/day
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Fleet Listings Table / Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900">Your Posted Vehicles</h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">Loading your vehicle fleet...</div>
        ) : fleet.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Car className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">No vehicles listed yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have not posted any rental vehicles yet. Click "Add New Vehicle" to list your Cars, Bikes, or Scooters.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="py-3 px-6 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post Your First Vehicle</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fleet.map((item) => (
              <div key={item.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md flex flex-col justify-between">
                <div>
                  <div className="relative h-44 w-full bg-slate-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-extrabold shadow-sm ${
                      item.is_available ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-200'
                    }`}>
                      {item.is_available ? 'Available' : 'Rented Out'}
                    </span>
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-sm">
                      {item.category}
                    </span>
                  </div>

                  <div className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-900 text-base">{item.title}</h3>
                      <span className="font-black text-blue-600 text-base">₹{item.price_per_day}<span className="text-xs font-normal text-slate-400">/day</span></span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>

                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 pt-1">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg">{item.fuel}</span>
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg">{item.transmission}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 flex items-center justify-between border-t border-slate-100 mt-4">
                  <button
                    onClick={() => handleToggle(item.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      item.is_available ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {item.is_available ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{item.is_available ? 'Mark Rented' : 'Mark Available'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Post New Vehicle Listing</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                ✕
              </button>
            </div>

            <form onSubmit={handlePostVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Name / Model</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Enfield Classic 350 / Honda City"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bike">Bike (Cruiser/Sports)</option>
                    <option value="Scooter">Scooter (Automatic)</option>
                    <option value="Car">Car (Sedan/Hatchback/SUV)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Price (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="450"
                    value={formData.price_per_day}
                    onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fuel Type</label>
                  <select
                    value={formData.fuel}
                    onChange={(e) => setFormData({ ...formData, fuel: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="EV Electric">EV Electric</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transmission</label>
                  <select
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Image URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Description & Pickup Rules</label>
                <textarea
                  rows={3}
                  placeholder="Well maintained 125cc scooter. Helmet included. Pickup at Sanquelim gate."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
              >
                {submitting ? 'Posting Vehicle...' : 'Publish Vehicle Listing'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
