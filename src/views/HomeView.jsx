import React from 'react';
import SearchBar from '../components/SearchBar';
import { Bike, Users, MapPin, Luggage, Star, ArrowRight, Navigation, Zap } from 'lucide-react';

export default function HomeView({ currentUser, setActiveTab, onLogAction, places }) {
  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Student';

  const quickCards = [
    {
      id: 'rentals',
      title: 'Rent Vehicle',
      subtitle: 'Scooters, bikes & cars around campus',
      bgGradient: 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800',
      iconBg: 'bg-blue-400/30 text-white',
      icon: Bike,
      tab: 'rentals',
      badge: '7 Vehicles'
    },
    {
      id: 'travel',
      title: 'Find Travel Buddy',
      subtitle: 'Split cabs to airport, station & Panjim',
      bgGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800',
      iconBg: 'bg-emerald-400/30 text-white',
      icon: Users,
      tab: 'travel',
      badge: '4 Active Rides'
    },
    {
      id: 'explore',
      title: 'Explore Goa',
      subtitle: 'Student-picked beaches, cafes & waterfalls',
      bgGradient: 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
      iconBg: 'bg-orange-400/30 text-white',
      icon: MapPin,
      tab: 'explore',
      badge: '8 Top Spots'
    },
    {
      id: 'planner',
      title: 'Trip Planner',
      subtitle: 'Plan your weekend getaway with friends',
      bgGradient: 'bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800',
      iconBg: 'bg-purple-400/30 text-white',
      icon: Luggage,
      tab: 'explore',
      badge: 'Weekend Special'
    }
  ];

  const handleCardClick = (card) => {
    onLogAction('QUICK_CARD_CLICK', `Clicked homepage quick action card: ${card.title}`);
    setActiveTab(card.tab);
  };

  const handleSearchFocus = () => {
    onLogAction('SEARCH_FOCUS', 'User clicked main search bar on homepage');
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 py-6 space-y-8 pb-20">
      {/* Hero Banner with Search */}
      <div className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold backdrop-blur-md">
            <Zap className="w-3.5 h-3.5" />
            <span>Goa Institute of Management Campus Mobility</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Where do you want to explore today, <span className="text-blue-400">{firstName}</span>?
          </h1>

          <p className="text-slate-300 text-xs md:text-base leading-relaxed max-w-2xl">
            Rent scooters, split rides to Dabolim Airport & Mopa, explore student-voted beaches and cafes, all in one place.
          </p>

          <div className="pt-2 max-w-2xl">
            <SearchBar
              placeholder="Search Activa, Arambol beach, Airport cabs, cafes..."
              onFocus={handleSearchFocus}
            />
          </div>
        </div>

        {/* Decorative Background Effects */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-16 w-[400px] h-[400px] rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
      </div>

      {/* 4 Quick Action Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-slate-900">
            Campus Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 md:gap-6">
          {quickCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={`relative overflow-hidden rounded-3xl p-5 md:p-6 text-left text-white shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-200 min-h-[160px] md:min-h-[180px] flex flex-col justify-between ${card.bgGradient}`}
              >
                {/* Icon & Badge */}
                <div className="flex items-center justify-between w-full">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center backdrop-blur-md ${card.iconBg}`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] md:text-[11px] font-bold px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-white">
                    {card.badge}
                  </span>
                </div>

                {/* Title & Subtitle */}
                <div className="z-10 mt-3 md:mt-4">
                  <h3 className="font-extrabold text-base md:text-xl leading-tight drop-shadow-sm">{card.title}</h3>
                  <p className="text-[11px] md:text-xs font-medium text-white/85 mt-1 leading-snug">{card.subtitle}</p>
                </div>

                {/* Background Vector Overlay */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full border-4 border-white/10 pointer-events-none" />
                <div className="absolute -bottom-2 -right-2 opacity-15 pointer-events-none">
                  <Icon className="w-28 h-28 stroke-[1]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommended Places Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Recommended Places</h2>
            <p className="text-xs text-slate-500">Student-voted beaches, cafes & natural spots</p>
          </div>
          <button
            onClick={() => {
              onLogAction('SEE_ALL_CLICK', 'Clicked See All recommended places');
              setActiveTab('explore');
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-3.5 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            <span>See all places</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Responsive Full-Width Grid of Recommended Places */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {places && places.length > 0 ? (
            places.map((place) => (
              <div
                key={place.id}
                onClick={() => {
                  onLogAction('VIEW_PLACE', `Viewed place details: ${place.name}`);
                  setActiveTab('explore');
                }}
                className="bg-white rounded-3xl overflow-hidden card-shadow border border-slate-200/70 hover:border-blue-200 transition-all hover:shadow-xl cursor-pointer flex flex-col justify-between"
              >
                <div className="relative h-48 w-full bg-slate-100">
                  <img
                    src={place.image}
                    alt={place.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-slate-800 shadow-sm">
                    {place.category}
                  </span>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-sm">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{place.rating}</span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-base leading-snug">{place.name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{place.distance}</span>
                  </p>
                  {place.price && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                      <span>Budget:</span>
                      <span>{place.price}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 col-span-full">Loading places...</div>
          )}
        </div>
      </div>
    </div>
  );
}
