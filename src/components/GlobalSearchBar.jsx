import React, { useState, useEffect, useRef } from 'react';
import { Search, Bike, MapPin, Users, Compass, Sparkles, X, ArrowRight, TrendingUp } from 'lucide-react';

export default function GlobalSearchBar({
  rentals = [],
  places = [],
  trips = [],
  setActiveTab,
  onLogAction
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const containerRef = useRef(null);

  // Close drop-down when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Explore Goa recommended popular places
  const popularSearches = [
    { title: 'Mandrem Beach & Lagoon', type: 'explore', tab: 'explore', subtitle: 'Pristine Beach & Serene Sunset · North Goa' },
    { title: 'Fontainhas Latin Quarter', type: 'explore', tab: 'explore', subtitle: 'Heritage Architecture & Cafes · Panjim' },
    { title: 'Dudhsagar Waterfalls Trek', type: 'explore', tab: 'explore', subtitle: 'Iconic Waterfalls & Jungle Jeep Trek' },
    { title: 'Vagator & Chapora Fort', type: 'explore', tab: 'explore', subtitle: 'Dil Chahta Hai Fort & Sunset Cliff' },
    { title: 'Palolem & Butterfly Island', type: 'explore', tab: 'explore', subtitle: 'White Sand Beach & Kayaking · South Goa' },
    { title: 'Anjuna Flea Market & Sunset Spot', type: 'explore', tab: 'explore', subtitle: 'Handicrafts, Vibes & Cliff Cafes' },
    { title: 'Divar Island Ferry Voyage', type: 'explore', tab: 'explore', subtitle: 'Scenic Ferry Ride & Village Trails' }
  ];

  // App-wide filtered results matching query
  const qLower = query.toLowerCase().trim();

  const matchedRentals = (rentals || []).filter((r) =>
    (r.title || '').toLowerCase().includes(qLower) ||
    (r.category || '').toLowerCase().includes(qLower) ||
    (r.vendor || '').toLowerCase().includes(qLower)
  );

  const matchedPlaces = (places || []).filter((p) =>
    (p.name || '').toLowerCase().includes(qLower) ||
    (p.category || '').toLowerCase().includes(qLower) ||
    (p.description || '').toLowerCase().includes(qLower)
  );

  const matchedTrips = (trips || []).filter((t) =>
    (t.title || '').toLowerCase().includes(qLower) ||
    (t.destination || '').toLowerCase().includes(qLower) ||
    (t.pickup || '').toLowerCase().includes(qLower)
  );

  const hasQuery = qLower.length > 0;

  const handleItemSelect = (itemTab, logTitle) => {
    if (onLogAction) {
      onLogAction('GLOBAL_SEARCH_SELECT', `Selected search result: ${logTitle} -> tab: ${itemTab}`);
    }
    setIsOpen(false);
    if (setActiveTab) {
      setActiveTab(itemTab);
    }
  };

  const handleSubmitSearch = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (onLogAction) {
      onLogAction('GLOBAL_SEARCH_SUBMIT', `Submitted search query: ${query}`);
    }

    setIsOpen(false);

    // If query matches a rental vehicle (Activa, City, Verna, etc.) -> go to Rentals
    if (matchedRentals.length > 0) {
      if (setActiveTab) setActiveTab('rentals');
    } else if (matchedPlaces.length > 0) {
      if (setActiveTab) setActiveTab('explore');
    } else if (matchedTrips.length > 0) {
      if (setActiveTab) setActiveTab('travel');
    } else {
      // General search query -> navigate to explore or rentals
      if (setActiveTab) setActiveTab('explore');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl text-slate-900 z-30">
      {/* Search Input Box (Google Inspired Glass Bar) */}
      <form onSubmit={handleSubmitSearch} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5 text-blue-500" />
        </div>

        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmitSearch(e);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Search Explore Goa places (Mandrem beach, Fontainhas, Dudhsagar...)"
          className="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl sm:rounded-3xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-xl transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(true);
            }}
            className="absolute right-3 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Recommendations & App-wide Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-fadeIn space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Header & Filter Segmented Control */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>{hasQuery ? 'Search Results' : 'Recommended Explore Goa Places'}</span>
            </div>

            {hasQuery && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold text-slate-600">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeFilter === 'all' ? 'bg-white text-blue-600 font-extrabold shadow-xs' : 'hover:text-slate-900'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter('rentals')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeFilter === 'rentals' ? 'bg-white text-blue-600 font-extrabold shadow-xs' : 'hover:text-slate-900'}`}
                >
                  Rentals
                </button>
                <button
                  onClick={() => setActiveFilter('explore')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeFilter === 'explore' ? 'bg-white text-blue-600 font-extrabold shadow-xs' : 'hover:text-slate-900'}`}
                >
                  Places
                </button>
                <button
                  onClick={() => setActiveFilter('travel')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${activeFilter === 'travel' ? 'bg-white text-blue-600 font-extrabold shadow-xs' : 'hover:text-slate-900'}`}
                >
                  Rides
                </button>
              </div>
            )}
          </div>

          {/* STATE 1: Empty Query -> Show Google Style Popular Searches */}
          {!hasQuery && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                <span>Popular Recommendations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {popularSearches.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleItemSelect(item.tab, item.title)}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/80 border border-slate-100 hover:border-blue-200 text-left transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {item.type === 'rental' && <Bike className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        {item.type === 'explore' && <Compass className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        {item.type === 'travel' && <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        <span className="font-extrabold text-xs text-slate-800 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-medium pl-5">
                        {item.subtitle}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STATE 2: Query Typed -> Live Results Across 3 Modules */}
          {hasQuery && (
            <div className="space-y-3">
              {/* Rentals Matches */}
              {(activeFilter === 'all' || activeFilter === 'rentals') && matchedRentals.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider block px-2">
                    🛵 Vehicle Rentals ({matchedRentals.length})
                  </span>
                  {matchedRentals.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleItemSelect('rentals', r.title)}
                      className="w-full p-2.5 rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-200 text-left flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img src={r.image} alt={r.title} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <span className="font-extrabold text-xs text-slate-900 block">{r.title}</span>
                          <span className="text-[10px] text-slate-500 font-medium">₹{r.price_per_day}/day · {r.vendor}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-extrabold">
                        {r.category || 'Rental'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Explore Matches */}
              {(activeFilter === 'all' || activeFilter === 'explore') && matchedPlaces.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-orange-600 uppercase tracking-wider block px-2">
                    🏖️ Explore Places ({matchedPlaces.length})
                  </span>
                  {matchedPlaces.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleItemSelect('explore', p.name)}
                      className="w-full p-2.5 rounded-2xl hover:bg-orange-50 border border-transparent hover:border-orange-200 text-left flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <span className="font-extrabold text-xs text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{p.distance} · {p.price}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-extrabold">
                        {p.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Travel Rides Matches */}
              {(activeFilter === 'all' || activeFilter === 'travel') && matchedTrips.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block px-2">
                    🚕 Travel Rides & Cabs ({matchedTrips.length})
                  </span>
                  {matchedTrips.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleItemSelect('travel', t.title)}
                      className="w-full p-2.5 rounded-2xl hover:bg-emerald-50 border border-transparent hover:border-emerald-200 text-left flex items-center justify-between transition-all"
                    >
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 block">{t.title}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{t.date_time} · {t.seats_left} seats left</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-extrabold">
                        {t.cost || 'Ride Pool'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* No Matches Found */}
              {matchedRentals.length === 0 && matchedPlaces.length === 0 && matchedTrips.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-bold text-slate-700">No matching vehicles or places found for "{query}"</p>
                  <p className="text-[11px]">Try searching for "Activa", "Honda City", "Beach", or "Airport"</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
