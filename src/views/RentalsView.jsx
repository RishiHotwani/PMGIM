import React, { useState } from 'react';
import { Bike, Shield, Clock, Star, MapPin, Search, Info, Fuel, Gauge, Car, X, Phone } from 'lucide-react';
import BookingCheckoutModal from '../components/BookingCheckoutModal';

export default function RentalsView({ rentals = [], loading = false, onLogAction, currentUser, onRefresh }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [checkoutVehicle, setCheckoutVehicle] = useState(null);

  const categories = ['All', 'Bikes', 'Scooters', 'Cars'];

  const filteredRentals = rentals.filter((item) => {
    const itemCatLower = (item.category || '').toLowerCase();
    const selCatLower = selectedCategory.toLowerCase();

    const matchesCategory =
      selectedCategory === 'All' ||
      itemCatLower.includes(selCatLower.replace(/s$/, '')) ||
      selCatLower.includes(itemCatLower);

    const matchesSearch =
      (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.vendor || '').toLowerCase().includes(searchTerm.toLowerCase());

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

  const normalizeWa = (phone) => {
    if (!phone) return null;
    const d = String(phone).replace(/\D/g,'');
    if (d.length===10) return `91${d}`;
    if (d.length===12 && d.startsWith('91')) return d;
    if (d.length===11 && d.startsWith('0')) return `91${d.slice(1)}`;
    return d;
  };
  const waLink = (phone, title) => {
    const wa = normalizeWa(phone);
    if (!wa) return null;
    return `https://wa.me/${wa}?text=${encodeURIComponent(`Hi! I'm interested in renting "${title}". Is it available?`)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
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
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-extrabold">Loading verified vehicles from MySQL database...</p>
        </div>
      ) : filteredRentals.length === 0 ? (
        <div className="py-16 bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-500 space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
            <Bike className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">No Vehicles Available</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No vehicles have been listed yet. Check back soon or become a vendor to list a vehicle.
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="py-2.5 px-5 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20"
            >
              Refresh Rentals Catalog
            </button>
          )}
        </div>
      ) : (
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
                <span className="absolute top-3 left-3 px-3 py-1 bg-blue-600 text-white text-[10px] font-extrabold rounded-full shadow-md">
                  {item.category || 'Rental'}
                </span>
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-full text-slate-900 text-xs font-bold flex items-center gap-1 shadow-md">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{item.rating || 5.0}</span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{item.vendor}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600">₹{item.price_per_day}</span>
                    <span className="text-[10px] text-slate-400 block font-bold">/day</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg">
                    <Fuel className="w-3.5 h-3.5 text-slate-400" />
                    {item.fuel || 'Petrol'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg">
                    <Gauge className="w-3.5 h-3.5 text-slate-400" />
                    {item.transmission || 'Manual'}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {(() => {
                    const phone = item.vendor_phone || item.phone || item.vendorPhone || '+919876500001';
                    return (
                      <>
                        <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold hover:bg-emerald-100">
                          <Phone className="w-3 h-3" /> {phone}
                        </a>
                        {waLink(phone, item.title) && (
                          <a href={waLink(phone, item.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-extrabold hover:bg-emerald-600">
                            WhatsApp
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex items-center gap-2">
              <button
                onClick={() => handleOpenDetail(item)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
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

              {(() => {
                const phone = selectedVehicle.vendor_phone || selectedVehicle.phone || selectedVehicle.vendorPhone || '+919876500001';
                return (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center"><Phone className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Vendor Contact</p>
                      <a href={`tel:${phone}`} className="font-extrabold text-slate-900">{phone}</a>
                      <p className="text-[11px] text-slate-500">{selectedVehicle.vendor}</p>
                    </div>
                    {waLink(phone, selectedVehicle.title) && (
                      <a href={waLink(phone, selectedVehicle.title)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold">WhatsApp</a>
                    )}
                  </div>
                );
              })()}

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
