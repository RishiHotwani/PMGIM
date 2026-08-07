import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import { Bookmark, Star, Navigation, DollarSign } from 'lucide-react';

export default function ExploreView({ places, onLogAction, onToggleBookmark }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'All', label: 'All Places', emoji: '🌟' },
    { id: 'Beaches', label: 'Beaches', emoji: '🏖️' },
    { id: 'Cafes', label: 'Cafes & Bakery', emoji: '☕' },
    { id: 'Food', label: 'Restaurants', emoji: '🍜' },
    { id: 'Waterfalls', label: 'Waterfalls', emoji: '🌊' },
    { id: 'Hospital', label: 'Hospitals', emoji: '🏥' },
  ];

  const filteredPlaces = (places || []).filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedCategory === 'All') return matchesSearch;
    return matchesSearch && item.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">Explore Goa</h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Student-voted beaches, cafes & natural spots near GIM campus</p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  onLogAction('FILTER_EXPLORE', `Filtered places by category: ${cat.id}`);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl">
        <SearchBar
          placeholder="Search Arambol beach, Britto's cafe, Dudhsagar falls..."
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            onLogAction('SEARCH_EXPLORE', `Searched Goa places for: ${val}`);
          }}
        />
      </div>

      {/* Subheader */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Showing {filteredPlaces.length} student-recommended spots
        </p>
      </div>

      {/* Responsive Grid (1 col mobile, 2 sm, 3 md, 4 lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredPlaces.map((place) => (
          <div
            key={place.id}
            className="bg-white rounded-3xl overflow-hidden card-shadow border border-slate-100 flex flex-col justify-between hover:shadow-xl hover:border-blue-200 transition-all"
          >
            {/* Image Container */}
            <div className="relative h-48 w-full bg-slate-100">
              <img
                src={place.image}
                alt={place.name}
                className="w-full h-full object-cover"
              />
              
              {/* Category Pill Top-Left */}
              <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-slate-800 shadow-sm">
                {place.category}
              </span>

              {/* Bookmark Button Top-Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(place.id);
                  onLogAction('TOGGLE_BOOKMARK', `Toggled bookmark for: ${place.name}`);
                }}
                className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md shadow-sm transition-transform active:scale-90 ${
                  place.is_bookmarked
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/90 text-slate-700 hover:bg-white'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${place.is_bookmarked ? 'fill-white' : ''}`} />
              </button>

              {/* Rating Pill Bottom-Right */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{place.rating}</span>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                  {place.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{place.distance}</span>
                </p>
              </div>

              {place.price && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Est. Budget:</span>
                  <span>{place.price}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
