import React, { useState } from 'react';
import { Bike, Shield, Clock, Star, MapPin, Search, PlusCircle, CheckCircle, Info, Fuel, Gauge, Car, X, Sparkles } from 'lucide-react';
import BookingCheckoutModal from '../components/BookingCheckoutModal';

export default function RentalsView({ rentals = [], onLogAction, currentUser, onRefreshRentals }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [checkoutVehicle, setCheckoutVehicle] = useState(null);

  // Vendor Add Vehicle Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isVendor = currentUser?.role === 'VENDOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState({
    title: '',
    category: 'Bike',
    price_per_day: '',
    fuel: 'Petrol',
    transmission: 'Automatic',
    tags: 'Verified Vendor',
    image: '',
    description: '',
    location: 'Sanquelim / Campus Gate'
  });

  const presetImages = [
    { label: 'Scooter (Activa)', url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80' },
    { label: 'Cruiser Bike (RE Hunter)', url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80' },
    { label: 'Hatchback Car (Swift)', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80' },
    { label: '125cc Scooter (Jupiter)', url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80' }
  ];

  const categories = ['All', 'Bikes', 'Scooters', 'Cars'];

  const filteredRentals = rentals.filter((item) => {
    const itemCatLower = (item.category || '').toLowerCase();
    const selCatLower = selectedCategory.toLowerCase();

    const matchesCategory =
      selectedCategory === 'All' ||
      itemCatLower.includes(selCatLower.replace(/s$/, '')) ||
      selCatLower.includes(itemCatLower);

    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleOpenDetail = (vehicle) => {
    setSelectedVehicle(vehicle);
    if (onLogAction) onLogAction('VIEW_RENTAL_DETAIL', `Opened specs for vehicle: ${vehicle.title}`);
  };

  const handleProceedToCheckout = (vehicle) => {
    setSelectedVehicle(null);
    setCheckoutVehicle(vehicle);
    if (onLogAction) onLogAction('START_RENTAL_CHECKOUT', `Initiated checkout for vehicle: ${vehicle.title}`);
  };

  const handlePostVehicle = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.price_per_day) {
      alert('Please provide Vehicle Title and Daily Rate.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'Vendor'
        },
        body: JSON.stringify({
          ...formData,
          image: formData.image || presetImages[0].url
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to post vehicle');

      setSuccessMsg(`🎉 Success! ${formData.title} is now listed for students to book.`);
      setShowAddModal(false);
      setFormData({
        title: '',
        category: 'Bike',
        price_per_day: '',
        fuel: 'Petrol',
        transmission: 'Automatic',
        tags: 'Verified Vendor',
        image: '',
        description: '',
        location: 'Sanquelim / Campus Gate'
      });

      if (onRefreshRentals) onRefreshRentals();
      if (onLogAction) onLogAction('POST_VENDOR_VEHICLE', `Vendor posted new vehicle: ${formData.title}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-extrabold text-sm ml-2">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <Bike className="w-3.5 h-3.5" />
            <span>Campus Vehicle Rentals</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Rent Bikes, Scooters & Cars
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Directly book verified self-drive vehicles from local Sanquelim vendors for campus commute and beach road trips.
          </p>
        </div>

        {/* Vendor Add Vehicle Quick Button */}
        {isVendor && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2 shrink-0 border border-emerald-400/30 hover:scale-105"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add New Vehicle</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                if (onLogAction) onLogAction('FILTER_RENTALS', `Filtered vehicles by category: ${cat}`);
              }}
              className={`py-2.5 px-5 rounded-2xl text-xs font-extrabold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by vehicle or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRentals.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-sm">
                  {item.category || 'Rental'}
                </span>
                <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/90 backdrop-blur-md text-slate-900 shadow-sm flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  {item.rating || 4.8}
                </span>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold">{item.vendor}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600">₹{item.price_per_day}</span>
                    <span className="text-xs text-slate-400 font-normal block">/day</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-blue-500" /> {item.fuel}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-indigo-500" /> {item.transmission}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex items-center gap-2">
              <button
                onClick={() => handleOpenDetail(item)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Specs</span>
              </button>

              <button
                onClick={() => handleProceedToCheckout(item)}
                className="w-1/2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Book Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vendor Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black">List New Rental Vehicle</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostVehicle} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Vehicle Name / Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Honda Activa 6G, Royal Enfield Hunter 350"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Vehicle Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Scooter">Scooter</option>
                    <option value="Bike">Bike</option>
                    <option value="Car">Car</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Daily Rate (₹ / Day) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 450"
                    value={formData.price_per_day}
                    onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Fuel Type</label>
                  <select
                    value={formData.fuel}
                    onChange={(e) => setFormData({ ...formData, fuel: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Electric">Electric</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Transmission</label>
                  <select
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Photo URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {/* Photo Presets */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">Presets:</span>
                  {presetImages.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setFormData({ ...formData, image: preset.url })}
                      className="px-2 py-1 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 shrink-0"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pickup Location</label>
                <input
                  type="text"
                  placeholder="e.g. Sanquelim Campus Gate"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description & Guidelines</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Clean helmets provided upon pickup. Valid driver license required."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <span>{submitting ? 'Posting Vehicle...' : 'Publish Vehicle Listing'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Specs Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedVehicle(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-700 hover:bg-white shadow-md transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative h-56 w-full bg-slate-100">
              <img src={selectedVehicle.image} alt={selectedVehicle.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent flex items-end p-6">
                <div>
                  <span className="px-3 py-1 bg-blue-600 text-white text-[11px] font-extrabold rounded-full shadow-sm mb-1 inline-block">
                    {selectedVehicle.category || 'Rental'}
                  </span>
                  <h2 className="text-2xl font-black text-white">{selectedVehicle.title}</h2>
                  <p className="text-xs text-slate-200 font-semibold">Vendor: {selectedVehicle.vendor}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Daily Rate</span>
                  <span className="text-base font-black text-blue-600">₹{selectedVehicle.price_per_day}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Fuel Type</span>
                  <span className="text-xs font-extrabold text-slate-800">{selectedVehicle.fuel}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Transmission</span>
                  <span className="text-xs font-extrabold text-slate-800">{selectedVehicle.transmission}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Description & Rules</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  {selectedVehicle.description || 'Verified rental vehicle. Clean helmets provided upon pickup. Valid driver license required.'}
                </p>
              </div>

              <button
                onClick={() => handleProceedToCheckout(selectedVehicle)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <span>Confirm & Reserve {selectedVehicle.title}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Booking Checkout Modal */}
      {checkoutVehicle && (
        <BookingCheckoutModal
          vehicle={checkoutVehicle}
          onClose={() => setCheckoutVehicle(null)}
          currentUser={currentUser}
          onLogAction={onLogAction}
        />
      )}
    </div>
  );
}
