import React, { useState, useEffect } from 'react';
import { Users, Car, MapPin, Calendar, Plus, MessageSquare, Check, X, Send } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';

export default function TravelView({ trips = [], onLogAction, currentUser, onRefreshTrips, onAddTrip }) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [messageModalTrip, setMessageModalTrip] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [createdTrips, setCreatedTrips] = useState([]);

  const [newTrip, setNewTrip] = useState({
    title: '',
    pickup: 'GIM Main Gate',
    date_time: 'Sat, 8 Aug · departs 5:30 AM',
    seats_total: 4,
    vehicle_type: 'Cab',
    cost: '₹500 each',
    description: ''
  });

  const filterOptions = ['All', 'Airport', 'Railway Station', 'Panjim'];

  const getInitials = (name) => {
    if (!name) return 'SU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const fetchTripMessages = async (tripId) => {
    if (!tripId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/messages`, {
        headers: {
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'Student'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMessages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch trip messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (messageModalTrip?.id) {
      fetchTripMessages(messageModalTrip.id);
    } else {
      setActiveMessages([]);
    }
  }, [messageModalTrip]);

  const handleSendMessage = async (tripId) => {
    if (!newMessageText.trim() || sendingMessage) return;
    const msgText = newMessageText.trim();
    setSendingMessage(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || currentUser?.uuid || '1'),
          'x-user-name': currentUser?.name || 'Student User'
        },
        body: JSON.stringify({ message: msgText, userName: currentUser?.name || 'Student User' })
      });

      if (res.ok) {
        const resData = await res.json();
        const created = resData.data || {
          id: Date.now(),
          trip_id: tripId,
          sender_user_id: String(currentUser?.id || currentUser?.uuid || '1'),
          sender_name: currentUser?.name || 'Student User',
          message: msgText,
          created_at: new Date().toISOString()
        };

        setActiveMessages((prev) => [...prev, created]);
        if (onLogAction) {
          onLogAction('MESSAGE_TRIP', `Sent message to ride host for trip ID #${tripId}: "${msgText}"`);
        }
        setNewMessageText('');
      }
    } catch (err) {
      console.error('Error sending ride message:', err);
    } finally {
      setSendingMessage(false);
    }
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
        userName: currentUser?.name || 'Student User',
        userInitials: computedInitials,
        batchInfo: `${currentUser?.batch || 'PGDM 2026'} · ${currentUser?.section || 'Sec A'}`,
        userId: currentUser?.id || currentUser?.uuid || ''
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
        const createdId = data.id || Date.now();

        // Optimistically prepend created ride to createdTrips state
        const createdRide = {
          id: createdId,
          host_user_id: currentUser?.id || currentUser?.uuid,
          user_name: payload.userName,
          user_initials: payload.userInitials,
          batch_info: payload.batchInfo,
          title: payload.title,
          pickup: payload.pickup,
          destination: payload.title,
          date_time: payload.date_time,
          seats_left: payload.seats_total,
          seats_total: payload.seats_total,
          vehicle_type: payload.vehicle_type,
          cost: payload.cost,
          description: payload.description,
          status: 'ACTIVE'
        };

        setCreatedTrips((prev) => [createdRide, ...prev]);
        if (onAddTrip) onAddTrip(createdRide); // Persist trip to top-level App state!
        setSelectedFilter('All'); // Reset filter to All so new ride is visible immediately!
        if (onLogAction) onLogAction('POST_TRIP', `Posted new ride share: ${newTrip.title}`);
        setIsModalOpen(false);
        setNewTrip({
          title: '',
          pickup: 'GIM Main Gate',
          date_time: 'Sat, 8 Aug · departs 5:30 AM',
          seats_total: 4,
          vehicle_type: 'Cab',
          cost: '₹500 each',
          description: ''
        });

        if (onRefreshTrips) onRefreshTrips();
      }
    } catch (err) {
      console.error('Error posting trip:', err);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-28 min-h-screen relative">
      {/* Header & Post Button Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">GIM Travel Buddy Board</h1>
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

                {/* Trip Title */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">{trip.title}</h2>
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

              {/* Action Buttons: Message & Join/Leave */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  onClick={() => {
                    setMessageModalTrip(trip);
                    onLogAction('OPEN_CHAT', `Opened chat message modal with ${trip.user_name}`);
                  }}
                  className="py-3 px-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  Message
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
              <h3 className="font-extrabold text-lg text-slate-900">Post Ride Share Trip</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dabolim Airport Drop"
                  value={newTrip.title}
                  onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })}
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

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
              >
                Post Ride to Travel Board
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Message / Chat Modal */}
      {messageModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Chat with {messageModalTrip.user_name}</h3>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">{messageModalTrip.title}</p>
              </div>
              <button onClick={() => setMessageModalTrip(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-64 overflow-y-auto bg-slate-50/80 rounded-2xl p-4 space-y-3 border border-slate-100 text-xs">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400 font-medium">
                  Loading chat history...
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                  <p className="font-bold text-slate-700 text-xs">No messages yet</p>
                  <p className="text-[11px] text-slate-400">Ask the ride host about pickup point & timing!</p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const currentUid = String(currentUser?.id || currentUser?.uuid || '');
                  const isMe = currentUid ? String(msg.sender_user_id) === currentUid : msg.sender_name === currentUser?.name;
                  const timeFormatted = msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now';

                  return (
                    <div
                      key={msg.id || Math.random()}
                      className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-sm space-y-1 ${
                        isMe
                          ? 'bg-blue-600 text-white ml-auto text-right rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 mr-auto text-left rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 font-bold mb-0.5">
                        <span>{msg.sender_name}</span>
                        <span className="font-normal text-[9px]">{timeFormatted}</span>
                      </div>
                      <p className="leading-relaxed font-medium">{msg.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessageText}
                disabled={sendingMessage}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(messageModalTrip.id)}
                className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage(messageModalTrip.id)}
                disabled={sendingMessage || !newMessageText.trim()}
                className="p-3 bg-blue-600 text-white rounded-2xl shadow-md hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
