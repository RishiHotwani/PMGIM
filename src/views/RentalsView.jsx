import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import { Bike, Car, CheckCircle2, Star, Fuel, Gauge, MapPin, Sparkles, Check, X } from 'lucide-react';

export default function RentalsView({ rentals, onLogAction, currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('Scooter');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingDays, setBookingDays] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const categories = [
    { id: 'Scooter', label: 'Scooter', icon: Sparkles },
    { id: 'Bike', label: 'Bike', icon: Bike },
    { id: 'Car', label: 'Car', icon: Car },
    { id: 'Available', label: 'Available', icon: CheckCircle2 },
  ];

  const filteredRentals = (rentals || []).filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'Available') return matchesSearch && item.is_available;
    if (selectedCategory === 'Scooter') return matchesSearch && (item.title.includes('Activa') || item.title.includes('Jupiter') || item.title.includes('Ather'));
    if (selectedCategory === 'Bike') return matchesSearch && (item.title.includes('Hunter') || item.title.includes('Duke') || item.title.includes('Royal'));
    if (selectedCategory === 'Car') return matchesSearch && (item.title.includes('Swift') || item.title.includes('Thar') || item.title.includes('Ertiga'));
    return matchesSearch;
  });

  const handleBookVehicle = async () => {
    if (!selectedVehicle) return;
    try {
      const res = await fetch(`/api/rentals/${selectedVehicle.id}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 1,
          'x-user-name': currentUser?.name || 'Suraj K'
        },
        body: JSON.stringify({
          userName: currentUser?.name || 'Suraj K',
          days: bookingDays
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBookingSuccess(true);
        onLogAction('RENTAL_BOOKING', `Booked ${selectedVehicle.title} for ${bookingDays} day(s) at ₹${selectedVehicle.price_per_day * bookingDays}`);
        setTimeout(() => {
          setBookingSuccess(false);
          setSelectedVehicle(null);
        }, 1800);
      }
    } catch (err) {
      console.error('Booking error:', err);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">Campus Vehicle Rentals</h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
            {rentals ? rentals.length : 7} verified vehicles available near GIM Sanquelim campus
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  onLogAction('FILTER_RENTALS', `Filtered rentals by category: ${cat.id}`);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-2xl">
        <SearchBar
          placeholder="Search Activa, Hunter 350, Swift, vendor name..."
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            onLogAction('SEARCH_RENTALS', `Searched rentals for: ${val}`);
          }}
        />
      </div>

      {/* Responsive Vehicle Cards Grid (1 col mobile, 2 md, 3 lg) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRentals.map((vehicle) => (
          <div
            key={vehicle.id}
            className="bg-white rounded-3xl overflow-hidden card-shadow border border-slate-100 transition-all hover:shadow-xl hover:border-blue-200 flex flex-col justify-between"
          >
            <div>
              {/* Image Container */}
              <div className="relative h-52 w-full bg-slate-100">
                <img
                  src={vehicle.image}
                  alt={vehicle.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Available Badge Top-Left */}
                {vehicle.is_available && (
                  <span className="absolute top-3 left-3 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-sm">
                    Available
                  </span>
                )}

                {/* Price Pill Bottom-Right */}
                <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-md text-slate-900 text-xs font-bold">
                  <span className="text-base font-extrabold text-blue-600">₹{vehicle.price_per_day}</span>
                  <span className="text-slate-500 text-[11px] font-normal"> /day</span>
                </div>
              </div>

              {/* Info Container */}
              <div className="p-5 space-y-3">
                {/* Title & Rating */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                      {vehicle.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
                      <span>{vehicle.vendor}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 text-white shrink-0" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{vehicle.rating}</span>
                    <span className="text-slate-400 font-normal">({vehicle.total_ratings})</span>
                  </div>
                </div>

                {/* Badges / Tags row */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-xl text-[11px] font-medium text-slate-700">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {vehicle.distance}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 rounded-xl text-[11px] font-medium text-blue-700">
                    <Fuel className="w-3 h-3 text-blue-600" />
                    {vehicle.fuel}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50/70 rounded-xl text-[11px] font-medium text-blue-700">
                    <Gauge className="w-3 h-3 text-blue-600" />
                    {vehicle.transmission}
                  </span>
                  {vehicle.tags && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 rounded-xl text-[11px] font-medium text-orange-700">
                      🌸 {vehicle.tags}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* View Details / Book Primary Button */}
            <div className="p-5 pt-0">
              <button
                onClick={() => {
                  setSelectedVehicle(vehicle);
                  onLogAction('VIEW_VEHICLE', `Opened details for vehicle: ${vehicle.title}`);
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-colors"
              >
                View details & Book
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 overflow-hidden shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900">Vehicle Rental Details</h3>
              <button onClick={() => setSelectedVehicle(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <img src={selectedVehicle.image} alt={selectedVehicle.title} className="w-24 h-20 rounded-xl object-cover" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">{selectedVehicle.title}</h4>
                <p className="text-xs text-slate-500">{selectedVehicle.vendor}</p>
                <p className="text-sm font-extrabold text-blue-600 mt-1">₹{selectedVehicle.price_per_day} <span className="text-xs text-slate-400 font-normal">/ day</span></p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-700">Select Duration (Days)</label>
              <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-2xl">
                <button
                  onClick={() => setBookingDays(Math.max(1, bookingDays - 1))}
                  className="w-10 h-10 rounded-xl bg-white font-bold text-slate-700 shadow-sm flex items-center justify-center text-lg hover:bg-slate-50"
                >
                  -
                </button>
                <span className="font-bold text-slate-900 text-sm">{bookingDays} Day(s)</span>
                <button
                  onClick={() => setBookingDays(bookingDays + 1)}
                  className="w-10 h-10 rounded-xl bg-white font-bold text-slate-700 shadow-sm flex items-center justify-center text-lg hover:bg-slate-50"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl text-xs text-blue-800 space-y-2 border border-blue-100">
              <div className="flex justify-between">
                <span>Daily Rental Rate:</span>
                <span className="font-semibold">₹{selectedVehicle.price_per_day}</span>
              </div>
              <div className="flex justify-between">
                <span>Refundable Deposit:</span>
                <span className="font-semibold">₹500</span>
              </div>
              <div className="flex justify-between border-t border-blue-200/60 pt-2 font-extrabold text-blue-950 text-base">
                <span>Total Payment:</span>
                <span>₹{selectedVehicle.price_per_day * bookingDays + 500}</span>
              </div>
            </div>

            {bookingSuccess ? (
              <div className="py-3.5 bg-emerald-600 text-white font-bold text-center rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30">
                <Check className="w-5 h-5" />
                Booking Confirmed & Saved to MySQL DB!
              </div>
            ) : (
              <button
                onClick={handleBookVehicle}
                className="w-full py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
              >
                Confirm & Rent Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
