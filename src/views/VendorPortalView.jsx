import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Bike, Car, Shield, Trash2, CheckCircle2, XCircle, DollarSign, MapPin, Tag, Loader2, AlertTriangle } from 'lucide-react';
import * as rentalService from '../services/rentalService';

export default function VendorPortalView({ currentUser, onRefreshRentals, onAddRental }) {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fleetError, setFleetError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Vehicle Saving State Machine: idle | saving | success | error
  const [vehicleSaveStatus, setVehicleSaveStatus] = useState('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [msg, setMsg] = useState('');

  // Guard against double-submit
  const isSubmittingRef = useRef(false);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Bike',
    price_per_day: '',
    sale_price: '',
    is_for_sale: true,
    fuel: 'Petrol',
    transmission: 'Manual',
    tags: 'Verified Vendor',
    image: '',
    description: '',
    location: 'Sanquelim / Campus Gate',
    vendor_phone: ''
  });

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'Bike',
      price_per_day: '',
      sale_price: '',
      is_for_sale: true,
      fuel: 'Petrol',
      transmission: 'Manual',
      tags: 'Verified Vendor',
      image: '',
      description: '',
      location: 'Sanquelim / Campus Gate',
      vendor_phone: ''
    });
  };

  // ─── FETCH VENDOR FLEET (race-safe via rentalService) ──────
  const fetchMyFleet = async () => {
    try {
      setFleetError(null);
      const data = await rentalService.fetchVendorFleet(currentUser);
      if (data !== null) {
        setFleet(data);
      }
    } catch (err) {
      console.error('[VendorPortal] fetchMyFleet error:', err.message);
      setFleetError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyFleet();
  }, [currentUser]);

  // ─── CREATE VEHICLE (database-first, no polling) ───────────
  const handlePostVehicle = async (e) => {
    e.preventDefault();

    // Prevent double-submit
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setVehicleSaveStatus('saving');
    setSaveErrorMessage('');
    setMsg('');

    try {
      // STEP 1: POST to backend → MySQL INSERT → verify → return DB record
      const result = await rentalService.createRental(currentUser, formData);
      
      console.log('[VendorPortal] Vehicle created:', {
        id: result.vehicle.id,
        title: result.vehicle.title
      });

      // Update parent App state immediately
      if (onAddRental && result.vehicle) {
        onAddRental(result.vehicle);
      }

      // STEP 2: Refresh vendor fleet from database (race-safe)
      const freshFleet = await rentalService.fetchVendorFleet(currentUser);
      if (freshFleet !== null) {
        setFleet(freshFleet);
      }

      // STEP 3: Refresh public rentals in App.jsx (race-safe)
      if (onRefreshRentals) await onRefreshRentals();

      // STEP 4: Success
      setVehicleSaveStatus('success');
      setMsg(`Vehicle "${result.vehicle.title}" verified in database and published for all users!`);

      // Auto-close modal after brief success display
      setTimeout(() => {
        setShowAddModal(false);
        setVehicleSaveStatus('idle');
        resetForm();
      }, 1200);

    } catch (err) {
      console.error('[VendorPortal] createVehicle error:', err.message);
      setVehicleSaveStatus('error');
      setSaveErrorMessage(err.message || 'Vehicle could not be saved. Please try again.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ─── TOGGLE AVAILABILITY ──────────────────────────────────
  const handleToggle = async (id) => {
    try {
      await rentalService.toggleAvailability(currentUser, id);
      await fetchMyFleet();
      if (onRefreshRentals) onRefreshRentals();
    } catch (err) {
      console.error('[VendorPortal] toggle error:', err.message);
    }
  };

  // ─── DELETE VEHICLE ───────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vehicle listing?')) return;
    try {
      await rentalService.deleteRental(currentUser, id);
      setMsg('Vehicle removed successfully.');
      setTimeout(()=>setMsg(''), 2500);
      await fetchMyFleet();
      if (onRefreshRentals) onRefreshRentals();
    } catch (err) {
      console.error('[VendorPortal] delete error:', err.message);
      alert(err.message || 'Delete failed. Try logging out and back in if session expired.');
    }
  };

  const isModalBusy = vehicleSaveStatus === 'saving';

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
          onClick={() => {
            setVehicleSaveStatus('idle');
            setSaveErrorMessage('');
            setShowAddModal(true);
          }}
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
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Vehicles</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{fleet.length}</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Now</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {fleet.filter((v) => v.is_available).length}
            </p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currently Rented</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {fleet.filter((v) => !v.is_available).length}
            </p>
          </div>
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Fleet Listings Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 space-y-4">
        <h2 className="text-lg font-black text-slate-900">Your Vehicle Listings</h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading your vehicles from database...</span>
          </div>
        ) : fleetError ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs font-bold text-red-600">Unable to load vehicles. {fleetError}</p>
            <button
              onClick={fetchMyFleet}
              className="py-2.5 px-4 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-500 transition-colors text-xs"
            >
              Retry
            </button>
          </div>
        ) : fleet.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-3">
            <p>You haven't listed any vehicles yet.</p>
            <button
              onClick={() => {
                setVehicleSaveStatus('idle');
                setSaveErrorMessage('');
                setShowAddModal(true);
              }}
              className="py-2.5 px-4 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-500 transition-colors"
            >
              Add Your First Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fleet.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-24 h-24 rounded-xl object-cover border border-slate-200"
                />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-600 uppercase tracking-wider">{item.category}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        item.is_available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.is_available ? 'Available' : 'Rented Out'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-slate-900">{item.title}</h3>

                  <div className="text-xs font-extrabold text-slate-700">₹{item.price_per_day} / day {item.sale_price ? <span className="text-amber-600">• Buy ₹{Number(item.sale_price).toLocaleString('en-IN')}</span> : null} {item.status==='SOLD' ? <span className="ml-1 px-2 py-0.5 bg-slate-900 text-white rounded-full text-[10px]">SOLD</span> : null}</div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>{item.fuel}</span>
                    <span>•</span>
                    <span>{item.transmission}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleToggle(item.id)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                        item.is_available
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
              <button
                disabled={isModalBusy}
                onClick={() => !isModalBusy && setShowAddModal(false)}
                className={`px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-700 ${isModalBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ← Back
              </button>
              <h3 className="font-extrabold text-base text-slate-900">Post New Vehicle Listing</h3>
              <button
                disabled={isModalBusy}
                onClick={() => !isModalBusy && setShowAddModal(false)}
                className={`p-1 rounded-full text-slate-400 hover:bg-slate-100 ${isModalBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ✕
              </button>
            </div>

            {/* ERROR ALERT DISPLAY */}
            {vehicleSaveStatus === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold space-y-1 animate-fadeIn">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Vehicle Save Failed</span>
                </div>
                <p className="text-[11px] text-red-600 font-medium">{saveErrorMessage}</p>
              </div>
            )}

            {/* SAVING STATE UI */}
            {vehicleSaveStatus === 'saving' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center animate-fadeIn">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <h4 className="text-base font-extrabold text-slate-900">Saving Vehicle</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Saving to database and verifying persistence...
                </p>
              </div>
            )}

            {/* SUCCESS STATE UI */}
            {vehicleSaveStatus === 'success' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center animate-fadeIn">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">Vehicle Verified & Published!</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Vehicle confirmed in database and is now live for all users.
                </p>
              </div>
            )}

            {/* FORM DISPLAY (idle or error state) */}
            {(vehicleSaveStatus === 'idle' || vehicleSaveStatus === 'error') && (
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Daily Price (₹/day)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="450"
                      value={formData.price_per_day}
                      onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.is_for_sale} onChange={(e)=>setFormData({...formData, is_for_sale:e.target.checked})} className="w-4 h-4 accent-blue-600" />
                    <span className="text-xs font-extrabold text-slate-800">Also list for sale (Buy option)</span>
                  </label>
                  {formData.is_for_sale && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sale Price (₹) — buy outright</label>
                      <input type="number" min="1000" placeholder="e.g. 95000 for Activa, 1150000 for City" value={formData.sale_price} onChange={(e)=>setFormData({...formData, sale_price:e.target.value})} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <p className="text-[11px] text-slate-500 mt-1">Buyers pay sale price + 5% GST + ₹500 service fee. Leave empty if rental-only.</p>
                    </div>
                  )}
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={formData.vendor_phone}
                    onChange={(e) => setFormData({ ...formData, vendor_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Shown to customers on your listing for direct contact.</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isModalBusy}
                    onClick={() => setShowAddModal(false)}
                    className="w-1/3 py-3.5 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isModalBusy}
                    className="w-2/3 py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Publish Vehicle Listing</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
