import React, { useState } from 'react';
import { Bike, Car, Filter, Star, CheckCircle, ShieldCheck, MapPin, Fuel, Gauge, Calendar, Info, X } from 'lucide-react';

export default function RentalsView({ rentals, onLogAction, currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingDays, setBookingDays] = useState(1);
  const [bookingDate, setBookingDate] = useState('Today');
  const [isBooking, setIsBooking] = useState(false);

  const categories = ['All', 'Bikes', 'Scooters', 'Cars'];

  const filteredRentals = rentals.filter((item) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Bikes') return item.category === 'Bike' || item.transmission === 'Manual' || item.title.toLowerCase().includes('enfield') || item.title.toLowerCase().includes('bike');
    if (selectedCategory === 'Scooters') return item.category === 'Scooter' || item.transmission === 'Automatic' || item.title.toLowerCase().includes('activa') || item.title.toLowerCase().includes('jupiter');
    if (selectedCategory === 'Cars') return item.category === 'Car' || item.title.toLowerCase().includes('swift') || item.title.toLowerCase().includes('car');
    return true;
  });

  const handleOpenDetail = (vehicle) => {
    setSelectedVehicle(vehicle);
    setBookingSuccess('');
    if (onLogAction) onLogAction('VIEW_RENTAL_DETAIL', `Viewed details for vehicle ${vehicle.title}`);
  };

  const handleConfirmBooking = async () => {
    if (!selectedVehicle) return;
    setIsBooking(true);
    setBookingSuccess('');

    try {
      const res = await fetch(`/api/rentals/${selectedVehicle.id}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'Customer'
        },
        body: JSON.stringify({
          userName: currentUser?.name || 'Student Customer',
          userId: currentUser?.id || null,
          days: bookingDays,
          startDate: bookingDate
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Booking failed');

      setBookingSuccess(data.message || 'Booking successful!');
      if (onLogAction) {
        onLogAction('BOOK_RENTAL', `Booked ${selectedVehicle.title} for ${bookingDays} day(s)`, JSON.stringify({ vehicleId: selectedVehicle.id, days: bookingDays }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Rentals Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Campus & Goa Rentals</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Scooters, Bikes & <span className="text-blue-400">Cars</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Rent verified campus scooters, cruiser bikes, and AC cars for daily commute or beach road trips across Goa.
          </p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                if (onLogAction) onLogAction('FILTER_RENTALS', `Filtered rentals by category: ${cat}`);
              }}
              className={`py-2.5 px-5 rounded-2xl text-xs font-extrabold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat === 'Bikes' && '🏍️ '}
              {cat === 'Scooters' && '🛵 '}
              {cat === 'Cars' && '🚗 '}
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs font-bold text-slate-400 shrink-0">
          Showing {filteredRentals.length} vehicles
        </span>
      </div>

      {/* Rental Grid */}
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

            <div className="p-5 pt-0 flex items-center gap-3">
              <button
                onClick={() => handleOpenDetail(item)}
                className="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                <span>View Specs & Book</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vehicle Specification & Booking Modal */}
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
              {bookingSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-extrabold space-y-2 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p>{bookingSuccess}</p>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="mt-2 py-2.5 px-5 bg-emerald-600 text-white rounded-xl font-extrabold text-xs"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Key Specifications Grid */}
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

                  {/* Booking Selector */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-700">Rental Duration (Days)</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setBookingDays(Math.max(1, bookingDays - 1))}
                          className="w-8 h-8 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200"
                        >
                          -
                        </button>
                        <span className="font-black text-sm text-slate-900">{bookingDays} Day(s)</span>
                        <button
                          type="button"
                          onClick={() => setBookingDays(bookingDays + 1)}
                          className="w-8 h-8 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                      <span>Total Estimated Rental Fee:</span>
                      <span className="text-lg font-black text-blue-600">₹{selectedVehicle.price_per_day * bookingDays}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmBooking}
                    disabled={isBooking}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{isBooking ? 'Processing Booking...' : `Confirm & Reserve ${selectedVehicle.title}`}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
