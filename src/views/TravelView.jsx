import React, { useState, useEffect } from 'react';
import { Users, Car, MapPin, Calendar, Plus, Phone, Check, X, Send, Edit, Pencil } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';

export default function TravelView({ trips = [], onLogAction, currentUser, onRefreshTrips, onAddTrip }) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [contactModalTrip, setContactModalTrip] = useState(null);
  const [createdTrips, setCreatedTrips] = useState([]);
  const [editingTrip, setEditingTrip] = useState(null);
  const [updatingTrip, setUpdatingTrip] = useState(false);

  const [newTrip, setNewTrip] = useState({
    title: '',
    destination: '',
    pickup: 'GIM Main Gate',
    date_time: 'Sat, 8 Aug · departs 5:30 AM',
    seats_total: 4,
    vehicle_type: 'Cab',
    cost: '₹500 each',
    description: '',
    contact_phone: ''
  });

  const filterOptions = ['All', 'Airport', 'Railway Station', 'Panjim'];

  const getInitials = (name) => {
    if (!name) return 'SU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const normalizePhoneForWhatsApp = (phone) => {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  };

  const getWhatsAppLink = (phone, trip) => {
    const waDigits = normalizePhoneForWhatsApp(phone);
    if (!waDigits) return null;
    const msg = `Hi ${trip?.user_name || 'there'}! I saw your Car Pooling ride "${trip?.title || ''}" from ${trip?.pickup || ''} to ${trip?.destination || ''} on ${trip?.date_time || ''}. Is a seat still available?`;
    return `https://wa.me/${waDigits}?text=${encodeURIComponent(msg)}`;
  };

  // Merge createdTrips with backend trips (createdTrips priority, deduplicated by ID)
  const allTripsMap = new Map();
  (createdTrips || []).forEach((t) => allTripsMap.set(String(t.id), t));
  (trips || []).forEach((t) => {
    if (!allTripsMap.has(String(t.id))) {
      allTripsMap.set(String(t.id), t);
    }
  });
  const mergedTrips = Array.from(allTripsMap.values());

  const filteredTrips = mergedTrips.filter((trip) => {
    if (selectedFilter === 'All') return true;
    const titleMatch = (trip.title || '').toLowerCase().includes(selectedFilter.toLowerCase());
    const destMatch = (trip.destination || '').toLowerCase().includes(selectedFilter.toLowerCase());
    const pickupMatch = (trip.pickup || '').toLowerCase().includes(selectedFilter.toLowerCase());
    return titleMatch || destMatch || pickupMatch;
  });

  const handleJoinTrip = async (tripId) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'Student'
        },
        body: JSON.stringify({ userName: currentUser?.name || 'Student' })
      });
      if (res.ok) {
        setJoinedTrips((prev) => [...prev, tripId]);
        setCreatedTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, seats_left: Math.max(0, (t.seats_left || 1) - 1), is_joined: true } : t))
        );
        onLogAction('JOIN_TRIP', `Joined ride share trip ID #${tripId}`);
        if (onRefreshTrips) onRefreshTrips();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Could not join ride.');
      }
    } catch (err) {
      console.error('Error joining trip:', err);
    }
  };

  const handleLeaveTrip = async (tripId) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/leave`, {
        method: 'DELETE',
        headers: {
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'Student'
        }
      });
      if (res.ok) {
        setJoinedTrips((prev) => prev.filter((id) => id !== tripId));
        setCreatedTrips((prev) =>
          prev.map((t) => (t.id === tripId ? { ...t, seats_left: (t.seats_left || 0) + 1, is_joined: false } : t))
        );
        onLogAction('LEAVE_TRIP', `Left ride share trip ID #${tripId}`);
        if (onRefreshTrips) onRefreshTrips();
      }
    } catch (err) {
      console.error('Error leaving trip:', err);
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    try {
      const isAvatarUrl = currentUser?.avatar && (currentUser.avatar.startsWith('http://') || currentUser.avatar.startsWith('https://'));
      const computedInitials = isAvatarUrl ? currentUser.avatar : getInitials(currentUser?.name);

      const payload = {
        ...newTrip,
        destination: newTrip.destination || newTrip.title,
        userName: currentUser?.name || 'Student User',
        userInitials: computedInitials,
        batchInfo: `${currentUser?.batch || 'PGDM 2026'} · ${currentUser?.section || 'Sec A'}`,
        userId: currentUser?.id || currentUser?.uuid || '',
        contact_phone: newTrip.contact_phone || currentUser?.phone_number || currentUser?.phone || ''
      };

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'User'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const createdRide = data.data || {
          id: data.id || Date.now(),
          host_user_id: currentUser?.id || currentUser?.uuid,
          user_name: payload.userName,
          user_initials: payload.userInitials,
          batch_info: payload.batchInfo,
          title: payload.title,
          pickup: payload.pickup,
          destination: payload.destination || payload.title,
          date_time: payload.date_time,
          seats_left: payload.seats_total,
          seats_total: payload.seats_total,
          vehicle_type: payload.vehicle_type,
          cost: payload.cost,
          description: payload.description,
          status: 'ACTIVE',
          contact_phone: payload.contact_phone
        };

        if (onAddTrip) onAddTrip(createdRide);
        setSelectedFilter('All');
        if (onLogAction) onLogAction('POST_TRIP', `Posted new ride share: ${newTrip.title}`);
        setIsModalOpen(false);
        setNewTrip({
          title: '',
          destination: '',
          pickup: 'GIM Main Gate',
          date_time: 'Sat, 8 Aug · departs 5:30 AM',
          seats_total: 4,
          vehicle_type: 'Cab',
          cost: '₹500 each',
          description: '',
          contact_phone: ''
        });

        if (onRefreshTrips) onRefreshTrips();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to save ride to database.');
      }
    } catch (err) {
      console.error('Error posting trip:', err);
    }
  };

  const handleUpdateTrip = async (e) => {
    e.preventDefault();
    if (!editingTrip) return;
    setUpdatingTrip(true);
    try {
      const res = await fetch(`/api/trips/${editingTrip.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'Student'
        },
        body: JSON.stringify({
          title: editingTrip.title,
          destination: editingTrip.destination || editingTrip.title,
          pickup: editingTrip.pickup,
          date_time: editingTrip.date_time,
          cost: editingTrip.cost,
          description: editingTrip.description
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.data || editingTrip;
        setCreatedTrips((prev) =>
          prev.map((t) => (t.id === editingTrip.id ? { ...t, ...updated } : t))
        );
        if (onLogAction) {
          onLogAction('UPDATE_TRIP', `Updated ride details for trip #${editingTrip.id}`);
        }
        if (onRefreshTrips) onRefreshTrips();
        setEditingTrip(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Could not update ride.');
      }
    } catch (err) {
      console.error('Error updating trip:', err);
    } finally {
      setUpdatingTrip(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-28 min-h-screen relative">
      {/* Header & Post Button Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">Car Pooling</h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
            {trips ? trips.length : 4} rides currently open for cab sharing & group trips
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setSelectedFilter(filter);
                  onLogAction('FILTER_TRAVEL', `Filtered travel board by: ${filter}`);
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                  selectedFilter === filter
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setIsModalOpen(true);
              onLogAction('OPEN_CREATE_TRIP', 'Opened modal to post a new travel ride');
            }}
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Post a Ride</span>
          </button>
        </div>
      </div>

      {/* Trips Cards Responsive Grid (1 col mobile, 2 md, 3 lg) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTrips.map((trip) => {
          const isJoined = Boolean(trip.is_joined || joinedTrips.includes(trip.id));
          const isFull = trip.seats_left === 0 || trip.status === 'FULL';
          const isHost = String(trip.host_user_id) === String(currentUser?.id || currentUser?.uuid || '');

          return (
            <div
              key={trip.id}
              className="bg-white rounded-3xl p-5 card-shadow border border-slate-100 space-y-4 relative hover:shadow-xl hover:border-blue-200 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Top row: Avatar, Name, Batch, Status Pill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={{ name: trip.user_name, avatar: trip.user_initials }} className="w-12 h-12 text-sm" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-tight">
                        {trip.user_name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate max-w-[170px]">
                        {trip.batch_info}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isHost && (
                      <button
                        onClick={() => setEditingTrip({ ...trip })}
                        title="Edit Ride Details"
                        className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isJoined
                          ? 'bg-emerald-100 text-emerald-700'
                          : isFull
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isJoined ? 'Joined' : isFull ? 'Full' : trip.status || 'Active'}
                    </span>
                  </div>
                </div>

                {/* Trip Title & Destination */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">{trip.title}</h2>
                  {trip.destination && (
                    <p className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>To: {trip.destination}</span>
                    </p>
                  )}
                  <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Pickup: {trip.pickup}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{trip.date_time}</span>
                    </p>
                  </div>
                </div>

                {/* Badges Row (Seats left, Cab type, Cost per person) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-orange-100">
                    <Users className="w-3.5 h-3.5" />
                    {trip.seats_left} of {trip.seats_total} seats left
                  </span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-blue-100">
                    <Car className="w-3.5 h-3.5" />
                    {trip.vehicle_type}
                  </span>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100">
                    {trip.cost}
                  </span>
                </div>

                {/* Note / Description */}
                {trip.description && (
                  <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                    {trip.description}
                  </p>
                )}
              </div>

              {/* Contact Info / WhatsApp */}
              {trip.contact_phone && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <a href={`tel:${trip.contact_phone}`} className="hover:underline">{trip.contact_phone}</a>
                    {getWhatsAppLink(trip.contact_phone, trip) && (
                      <a
                        href={getWhatsAppLink(trip.contact_phone, trip)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onLogAction && onLogAction('CONTACT_WHATSAPP', `Opened WhatsApp for ride #${trip.id}`)}
                        className="ml-auto px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[11px] font-extrabold flex items-center gap-1"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}
              {/* Action Buttons: Contact & Join/Leave */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  onClick={() => {
                    setContactModalTrip(trip);
                    onLogAction('OPEN_CONTACT', `Viewed contact for ${trip.user_name}`);
                  }}
                  className="py-3 px-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Contact
                </button>

                {isJoined ? (
                  <button
                    onClick={() => handleLeaveTrip(trip.id)}
                    title="Click to leave ride"
                    className="py-3 px-4 bg-emerald-50 hover:bg-red-50 border border-emerald-200 hover:border-red-200 text-emerald-700 hover:text-red-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                  >
                    <Check className="w-4 h-4 text-emerald-600 group-hover:hidden" />
                    <X className="w-4 h-4 text-red-600 hidden group-hover:block" />
                    <span className="group-hover:hidden">Joined</span>
                    <span className="hidden group-hover:inline">Leave</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoinTrip(trip.id)}
                    disabled={isFull}
                    className="py-3 px-4 bg-blue-600 text-white rounded-2xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isFull ? 'Full' : 'Join Ride'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Floating Action Button (+) */}
      <button
        onClick={() => {
          setIsModalOpen(true);
          onLogAction('OPEN_CREATE_TRIP', 'Opened modal to post a new travel ride');
        }}
        className="sm:hidden fixed bottom-20 right-6 z-30 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40"
        title="Post a Ride Share"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Post Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-700">← Back</button>
              <h3 className="font-extrabold text-lg text-slate-900">Post Ride Share Trip</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ride Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Early Morning Dabolim Cab Share"
                  value={newTrip.title}
                  onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination / Drop-off Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dabolim Airport, MOPA, Panjim"
                  value={newTrip.destination}
                  onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Location</label>
                <input
                  type="text"
                  required
                  placeholder="GIM Main Gate"
                  value={newTrip.pickup}
                  onChange={(e) => setNewTrip({ ...newTrip, pickup: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Date & Time</label>
                <input
                  type="text"
                  required
                  placeholder="Sat, 8 Aug · departs 5:30 AM"
                  value={newTrip.date_time}
                  onChange={(e) => setNewTrip({ ...newTrip, date_time: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Seats</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={newTrip.seats_total}
                    onChange={(e) => setNewTrip({ ...newTrip, seats_total: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Type</label>
                  <select
                    value={newTrip.vehicle_type}
                    onChange={(e) => setNewTrip({ ...newTrip, vehicle_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Cab">Cab</option>
                    <option value="Car">Car</option>
                    <option value="Auto">Auto</option>
                    <option value="Scooter">Scooter</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cost per Person</label>
                <input
                  type="text"
                  placeholder="₹600 each"
                  value={newTrip.cost}
                  onChange={(e) => setNewTrip({ ...newTrip, cost: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
                <textarea
                  rows="2"
                  placeholder="Pre-booked Innova from GIM gate. Flight at 9 AM..."
                  value={newTrip.description}
                  onChange={(e) => setNewTrip({ ...newTrip, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newTrip.contact_phone}
                  onChange={(e) => setNewTrip({ ...newTrip, contact_phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Will be shown to others for Car Pooling contact via Phone & WhatsApp.</p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
              >
                Post Ride to Car Pooling
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trip Modal */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Edit Ride Details</h3>
                <p className="text-xs text-slate-500">Trip ID #{editingTrip.id}</p>
              </div>
              <button onClick={() => setEditingTrip(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ride Title</label>
                <input
                  type="text"
                  required
                  value={editingTrip.title || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination / Drop-off Location</label>
                <input
                  type="text"
                  required
                  value={editingTrip.destination || editingTrip.title || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, destination: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Location</label>
                <input
                  type="text"
                  required
                  value={editingTrip.pickup || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, pickup: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Date & Time</label>
                <input
                  type="text"
                  required
                  value={editingTrip.date_time || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, date_time: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cost per Person</label>
                <input
                  type="text"
                  value={editingTrip.cost || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, cost: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
                <textarea
                  rows="2"
                  value={editingTrip.description || ''}
                  onChange={(e) => setEditingTrip({ ...editingTrip, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrip(null)}
                  className="w-1/2 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingTrip}
                  className="w-1/2 py-3 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {updatingTrip ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {contactModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Contact {contactModalTrip.user_name}</h3>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">{contactModalTrip.title}</p>
              </div>
              <button onClick={() => setContactModalTrip(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <UserAvatar user={{ name: contactModalTrip.user_name, avatar: contactModalTrip.user_initials }} className="w-12 h-12 text-sm" />
                <div>
                  <p className="font-extrabold text-sm text-slate-900">{contactModalTrip.user_name}</p>
                  <p className="text-xs text-slate-500">{contactModalTrip.batch_info}</p>
                </div>
              </div>
              {contactModalTrip.contact_phone ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center"><Phone className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Phone / WhatsApp</p>
                      <a href={`tel:${contactModalTrip.contact_phone}`} className="font-extrabold text-slate-900 hover:underline">{contactModalTrip.contact_phone}</a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <a href={`tel:${contactModalTrip.contact_phone}`} className="py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 text-center">
                      <Phone className="w-4 h-4" /> Call Now
                    </a>
                    {getWhatsAppLink(contactModalTrip.contact_phone, contactModalTrip) && (
                      <a href={getWhatsAppLink(contactModalTrip.contact_phone, contactModalTrip)} target="_blank" rel="noopener noreferrer" className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 text-center">
                        WhatsApp
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">Contact directly to confirm pickup time and seat.</p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-center text-xs text-amber-700 font-medium">No contact number provided for this ride.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
