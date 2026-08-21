import React, { useState, useEffect } from 'react';
import { MapPin, Star, Heart, Compass, Info, Search, X, Sparkles, Filter, Plus, AlertTriangle } from 'lucide-react';
import SpotDetailModal from '../components/SpotDetailModal';

export default function ExploreView({ places = [], onLogAction, currentUser, onToggleBookmark, initialSearchQuery = '', initialSpotId = null, onAddPlace }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlace, setNewPlace] = useState({ name: '', category: 'Beaches', distance: '', price: '', image: '', description: '', maps_url: '', best_time: '', est_cost: '', pro_tips: '' });
  const [customCategory, setCustomCategory] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [submittingPlace, setSubmittingPlace] = useState(false);

  // Sync initial search query or spot selection if passed as props
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (initialSpotId && places.length > 0) {
      const match = places.find((p) => String(p.id) === String(initialSpotId));
      if (match) {
        setSelectedSpot(match);
      }
    }
  }, [initialSpotId, places]);

  const dynamicCategories = Array.from(
    new Set(places.map((p) => p.category).filter(Boolean))
  );
  const categories = ['All', ...dynamicCategories];

  const qLower = searchQuery.toLowerCase().trim();

  const filteredPlaces = places.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      !qLower ||
      (item.name || '').toLowerCase().includes(qLower) ||
      (item.category || '').toLowerCase().includes(qLower) ||
      (item.description || '').toLowerCase().includes(qLower) ||
      (item.pro_tips || '').toLowerCase().includes(qLower) ||
      (item.distance || '').toLowerCase().includes(qLower);

    return matchesCategory && matchesSearch;
  });

  const handleOpenSpot = (spot) => {
    setSelectedSpot(spot);
    if (onLogAction) onLogAction('VIEW_EXPLORE_SPOT', `Opened details for spot: ${spot.name}`);
  };

  const handleToggleBookmarkClick = (e, spotId) => {
    e.stopPropagation();
    if (!currentUser?.id && !currentUser?.uuid && !currentUser?.email) {
      alert('Please log in to bookmark places.');
      return;
    }
    if (onToggleBookmark) {
      onToggleBookmark(spotId);
    }
  };

  const getMapsUrl = (spot) => {
    if (spot.maps_url) return spot.maps_url;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Goa')}`;
  };

  const isDuplicateName = (name) => {
    const norm = String(name).trim().toLowerCase();
    return places.some(p => String(p.name).trim().toLowerCase() === norm);
  };

  const handleSuggestPlace = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    const normName = String(newPlace.name).trim();
    if (!normName) { setAddError('Place name is required.'); return; }
    if (isDuplicateName(normName)) { setAddError(`"${normName}" already exists — duplicate not allowed.`); return; }
    if (!newPlace.image || !newPlace.description) { setAddError('Image URL and description are required.'); return; }
    const finalCategory = newPlace.category === 'Custom' ? customCategory.trim() : newPlace.category;
    if (newPlace.category === 'Custom' && !finalCategory) { setAddError('Please enter a custom category name.'); return; }
    const payload = { ...newPlace, category: finalCategory || 'Beaches' };
    setSubmittingPlace(true);
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
          'x-user-name': currentUser?.name || 'Student'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to add place');
      const created = data.data || data.place || { ...newPlace, id: data.id };
      if (onAddPlace) onAddPlace(created);
      else if (onLogAction) onLogAction('SUGGEST_PLACE', `Suggested new place: ${normName}`);
      setAddSuccess('Place added successfully!');
      setNewPlace({ name: '', category: 'Beaches', distance: '', price: '', image: '', description: '', maps_url: '', best_time: '', est_cost: '', pro_tips: '' });
      setTimeout(()=>{ setShowAddModal(false); setAddSuccess(''); }, 1000);
      if (onLogAction) onLogAction('SUGGEST_PLACE', `Suggested new place: ${normName}`);
    } catch (err) {
      setAddError(err.message);
    } finally { setSubmittingPlace(false); }
  };

  const popularChips = ['Chapora', 'Baga', 'Waterfalls', 'Old Goa', 'Dolphin', 'Nightlife', 'Forts'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <Compass className="w-3.5 h-3.5" />
            <span>Curated Goa Experiences ({places.length} Destinations)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Explore <span className="text-blue-400">Goa</span> Recommendations
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Discover beaches, waterfalls, food shacks, nightlife clubs & historic forts student-voted by GIM batchmates.
          </p>
        </div>

        {/* Total Badge */}
        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center shrink-0">
          <span className="text-2xl font-black block text-blue-300">{filteredPlaces.length}</span>
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Places Displayed</span>
        </div>
      </div>

      {/* In-Page Search Bar & Quick Chips */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-md space-y-4">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-blue-600 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (onLogAction) onLogAction('SEARCH_EXPLORE_PLACES', `Searched query: ${e.target.value}`);
            }}
            placeholder="Search all 28 recommendations by name, fort, beach, waterfall, or night club..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Quick Tags:
          </span>
          {popularChips.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setSearchQuery(chip);
                setSelectedCategory('All');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                searchQuery.toLowerCase().includes(chip.toLowerCase())
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              #{chip}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Category Filter Tabs */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                if (onLogAction) onLogAction('FILTER_EXPLORE', `Filtered places by category: ${cat}`);
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
        <span className="text-xs font-bold text-slate-400 shrink-0">
          Showing {filteredPlaces.length} of {places.length}
        </span>
      </div>

      {/* Spots Grid or Empty State */}
      {filteredPlaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaces.map((item) => {
            const hasUser = Boolean(currentUser?.id || currentUser?.uuid || currentUser?.email);
            const isBookmarked = hasUser ? (Boolean(item.is_bookmarked) && item.is_bookmarked !== '0' && item.is_bookmarked !== 0) : false;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-52 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-sm">
                      {item.category}
                    </span>

                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {/* Google Maps Quick Link Icon */}
                      <a
                        href={getMapsUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-white/90 backdrop-blur-md rounded-full text-blue-600 hover:bg-white shadow-md transition-all hover:scale-110"
                        title="Open in Google Maps"
                      >
                        <MapPin className="w-4 h-4 fill-blue-600/10" />
                      </a>

                      {/* Bookmark Button */}
                      <button
                        onClick={(e) => handleToggleBookmarkClick(e, item.id)}
                        className={`p-2 rounded-full backdrop-blur-md transition-all ${
                          isBookmarked
                            ? 'bg-rose-500 text-white shadow-md'
                            : 'bg-white/90 text-slate-600 hover:bg-white'
                        }`}
                        title={isBookmarked ? 'Remove Bookmark' : 'Save Bookmark'}
                      >
                        <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-white text-white' : ''}`} />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-950/70 backdrop-blur-md text-white flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span>{item.rating || 4.5}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <h3 className="font-black text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {item.description || item.distance}
                    </p>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-2 border-t border-slate-100">
                      <span className="text-slate-400">{item.distance}</span>
                      <span className="text-blue-600 font-extrabold">{item.price}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenSpot(item)}
                    className="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Info className="w-4 h-4" />
                    <span>View Details, Ratings & Reviews</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Filter className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900">No destinations found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              We couldn't find any place matching "{searchQuery}" under "{selectedCategory}" category.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-2xl shadow-md transition-all"
          >
            Reset Filters & View All {places.length} Recommendations
          </button>
        </div>
      )}

      {/* Floating + Button */}
      <button
        onClick={() => { setAddError(''); setAddSuccess(''); setShowAddModal(true); }}
        className="fixed bottom-20 right-6 sm:bottom-8 sm:right-8 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40"
        title="Suggest a new place"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Add Place Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button onClick={()=>setShowAddModal(false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-700">← Back</button>
              <h3 className="font-extrabold text-lg text-slate-900">Suggest a New Place</h3>
              <button onClick={()=>setShowAddModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            {addError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{addError}</div>}
            {addSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">{addSuccess}</div>}
            {newPlace.name && isDuplicateName(newPlace.name) && !addError && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">Duplicate detected: a place with this name already exists.</div>}
            <form onSubmit={handleSuggestPlace} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Place Name *</label>
                <input type="text" required value={newPlace.name} onChange={e=>setNewPlace({...newPlace, name:e.target.value})} placeholder="e.g. Hidden Waterfall near Sattari" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select value={newPlace.category} onChange={e=>{ setNewPlace({...newPlace, category:e.target.value}); if(e.target.value!=='Custom') setCustomCategory(''); }} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <option>Beaches</option><option>Food</option><option>Nightlife</option><option>Waterfalls</option><option>Shopping</option><option>Forts</option><option>Heritage</option><option>Adventure</option><option>Custom</option>
                  </select>
                  {newPlace.category === 'Custom' && (
                    <input type="text" value={customCategory} onChange={e=>setCustomCategory(e.target.value)} placeholder="e.g. Forts, Temple, Lake" className="w-full mt-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Distance / Travel</label>
                  <input type="text" value={newPlace.distance} onChange={e=>setNewPlace({...newPlace, distance:e.target.value})} placeholder="12 km · 20 min scooter" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Image URL *</label>
                <input type="url" required value={newPlace.image} onChange={e=>setNewPlace({...newPlace, image:e.target.value})} placeholder="https://..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                <textarea rows="3" required value={newPlace.description} onChange={e=>setNewPlace({...newPlace, description:e.target.value})} placeholder="Why students love it..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Best Time</label><input type="text" value={newPlace.best_time} onChange={e=>setNewPlace({...newPlace, best_time:e.target.value})} placeholder="5 PM – 7 PM" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" /></div>
                <div><label className="block text-xs font-bold text-slate-700 mb-1">Est. Cost</label><input type="text" value={newPlace.est_cost} onChange={e=>setNewPlace({...newPlace, est_cost:e.target.value})} placeholder="₹400 / person" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Google Maps URL</label>
                <input type="url" value={newPlace.maps_url} onChange={e=>setNewPlace({...newPlace, maps_url:e.target.value})} placeholder="https://www.google.com/maps/search/..." className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowAddModal(false)} className="w-1/3 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
                <button type="submit" disabled={submittingPlace || isDuplicateName(newPlace.name)} className="w-2/3 py-3 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-50"> {submittingPlace ? 'Adding...' : 'Add Place'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Reusable Spot Detail Modal */}
      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          currentUser={currentUser}
          onLogAction={onLogAction}
        />
      )}
    </div>
  );
}

