import React, { useState, useEffect } from 'react';
import { MapPin, Star, Heart, Compass, Info } from 'lucide-react';
import SpotDetailModal from '../components/SpotDetailModal';

export default function ExploreView({ places = [], onLogAction, currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [userBookmarks, setUserBookmarks] = useState({});

  const categories = ['All', 'Beaches', 'Waterfalls', 'Food', 'Forts', 'Nightlife'];

  const fetchUserBookmarks = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/bookmarks', {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.name || 'User'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach(b => { map[b.id] = true; });
        setUserBookmarks(map);
      }
    } catch (err) {
      console.error('Fetch bookmarks error:', err);
    }
  };

  useEffect(() => {
    fetchUserBookmarks();
  }, [currentUser]);

  const filteredPlaces = places.filter((item) => {
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  const handleOpenSpot = (spot) => {
    setSelectedSpot(spot);
    if (onLogAction) onLogAction('VIEW_EXPLORE_SPOT', `Opened details for spot: ${spot.name}`);
  };

  const handleToggleBookmark = async (spotId) => {
    if (!currentUser?.id) {
      alert('Please log in to bookmark places.');
      return;
    }

    try {
      setUserBookmarks(prev => ({ ...prev, [spotId]: !prev[spotId] }));
      await fetch(`/api/bookmarks/${spotId}/toggle`, {
        method: 'POST',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.name || 'User'
        }
      });
      fetchUserBookmarks();
    } catch (err) {
      console.error(err);
    }
  };

  const getMapsUrl = (spot) => {
    if (spot.maps_url) return spot.maps_url;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Goa')}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-extrabold text-blue-300">
            <Compass className="w-3.5 h-3.5" />
            <span>Curated Goa Experiences</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Explore <span className="text-blue-400">Goa</span> Beyond Campus
          </h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Discover beaches, waterfalls, food shacks, and historic forts recommended by fellow GIM students.
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
          {filteredPlaces.length} Destinations
        </span>
      </div>

      {/* Spots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaces.map((item) => {
          const isBookmarked = !!userBookmarks[item.id];
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(item.id);
                      }}
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
