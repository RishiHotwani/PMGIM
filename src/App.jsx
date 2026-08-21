import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import RentalsView from './views/RentalsView';
import ExploreView from './views/ExploreView';
import TripPlannerView from './views/TripPlannerView';
import TravelView from './views/TravelView';
import ProfileView from './views/ProfileView';
import AuthGateView from './views/AuthGateView';
import VendorPortalView from './views/VendorPortalView';
import { AuthProvider, useAuth } from './context/AuthContext';
import * as rentalService from './services/rentalService';
import { DEFAULT_EXPLORE_PLACES } from './data/defaultPlaces';
import { DEFAULT_TRAVEL_TRIPS } from './data/defaultTrips';
import { DEFAULT_RENTALS } from './data/defaultRentals';
import { trackEvent, trackPageView } from './services/mixpanel';

function MainAppContent() {
  const { currentUser, loading, logout, setCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  const [rentals, setRentals] = useState(DEFAULT_RENTALS);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const [rentalsError, setRentalsError] = useState(null);
  const [explorePlaces, setExplorePlaces] = useState(DEFAULT_EXPLORE_PLACES);
  const [travelTrips, setTravelTrips] = useState(DEFAULT_TRAVEL_TRIPS);

  // Ref to track if the component is mounted (prevent setState after unmount)
  const mountedRef = useRef(true);

  // ─── DEDICATED RENTAL FETCH (race-safe via rentalService) ───
  const refreshRentals = useCallback(async () => {
    try {
      setRentalsError(null);
      const data = await rentalService.fetchAllRentals();
      // data is null if the request was aborted/superseded — ignore
      if (data !== null && mountedRef.current && Array.isArray(data)) {
        setRentals(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setRentalsError(err.message);
        console.error('[App] refreshRentals error:', err.message);
      }
    } finally {
      if (mountedRef.current) {
        setRentalsLoading(false);
      }
    }
  }, []);

  const handleAddRental = useCallback((newRental) => {
    setRentals((prev) => [newRental, ...prev.filter((r) => String(r.id) !== String(newRental.id))]);
  }, []);

  // ─── FETCH EXPLORE PLACES ──────────────────────────
  const fetchExplorePlaces = useCallback(async () => {
    try {
      const res = await fetch('/api/explore', {
        headers: {
          'x-user-id': String(currentUser?.id || ''),
          'x-user-uuid': String(currentUser?.uuid || ''),
          'x-user-email': String(currentUser?.email || ''),
          'x-user-name': currentUser?.name || 'User',
          'Cache-Control': 'no-store'
        }
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Merge API places with default places to ensure no new place is omitted
          const apiMap = new Map(data.map((p) => [p.name.toLowerCase().trim(), p]));
          const merged = [...data];
          
          DEFAULT_EXPLORE_PLACES.forEach((defP) => {
            if (!apiMap.has(defP.name.toLowerCase().trim())) {
              merged.push(defP);
            }
          });

          setExplorePlaces(merged);
        }
      }
    } catch (err) {
      console.error('[App] fetchExplorePlaces error:', err.message);
    }
  }, [currentUser]);

  // ─── FETCH TRAVEL TRIPS ───────────────────────────
  const fetchTravelTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/trips', {
        headers: {
          'x-user-id': String(currentUser?.id || ''),
          'x-user-uuid': String(currentUser?.uuid || ''),
          'x-user-email': String(currentUser?.email || ''),
          'Cache-Control': 'no-store'
        }
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTravelTrips(data);
        }
      }
    } catch (err) {
      console.error('[App] fetchTravelTrips error:', err.message);
    }
  }, [currentUser]);

  const handleAddTrip = useCallback((newTrip) => {
    setTravelTrips((prev) => [newTrip, ...prev.filter((t) => String(t.id) !== String(newTrip.id))]);
  }, []);

  const handleAddPlace = useCallback((newPlace) => {
    setExplorePlaces((prev) => [newPlace, ...prev.filter((p) => String(p.id) !== String(newPlace.id) && String(p.name).trim().toLowerCase() !== String(newPlace.name).trim().toLowerCase())]);
    fetchExplorePlaces();
  }, [fetchExplorePlaces]);

  const fetchExploreAndTrips = useCallback(async () => {
    fetchExplorePlaces();
    fetchTravelTrips();
  }, [fetchExplorePlaces, fetchTravelTrips]);

  // ─── INITIAL DATA LOAD (runs on mount and user change ONLY) ─
  useEffect(() => {
    mountedRef.current = true;
    refreshRentals();
    fetchExploreAndTrips();

    return () => {
      mountedRef.current = false;
      rentalService.abortAll(); // Cancel any in-flight rental requests on unmount
    };
  }, [currentUser]);

  const [exploreSearchQuery, setExploreSearchQuery] = useState('');

  // Track tab views in Mixpanel (evaluation criteria)
  useEffect(() => {
    trackPageView(activeTab);
    trackEvent('Tab View', { tab: activeTab });
  }, [activeTab]);

  // ─── TAB CHANGE (NO fetchData call — no double-fetch) ───────
  const handleTabChange = (newTab, queryParam = '') => {
    trackEvent('Switch Tab', { to: newTab, query: queryParam });
    if (newTab === 'explore') {
      setExploreSearchQuery(typeof queryParam === 'string' ? queryParam : '');
    }
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleBookmark = async (id) => {
    if (!currentUser?.id && !currentUser?.uuid && !currentUser?.email) return;

    // Optimistic UI update
    setExplorePlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p))
    );

    try {
      const res = await fetch(`/api/bookmarks/${id}/toggle`, {
        method: 'POST',
        headers: {
          'x-user-id': String(currentUser?.id || ''),
          'x-user-uuid': String(currentUser?.uuid || ''),
          'x-user-email': String(currentUser?.email || ''),
          'x-user-name': currentUser?.name || 'User'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isBookmarked !== undefined) {
          setExplorePlaces((prev) =>
            prev.map((p) => (p.id === id ? { ...p, is_bookmarked: Boolean(data.isBookmarked) } : p))
          );
        }
      } else {
        // Rollback on non-OK response (e.g. 503 database unavailable or 401 unauthenticated)
        setExplorePlaces((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p))
        );
      }
    } catch (err) {
      console.error('Toggle bookmark error:', err);
      // Rollback on error
      setExplorePlaces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p))
      );
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-bold tracking-wide text-slate-300">Restoring Secure Auth Session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthGateView onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      <div className="app-container w-full min-h-screen flex flex-col">
        {/* Header */}
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
        />

        {/* Main Views */}
        <main className="flex-1 w-full">
          {activeTab === 'home' && (
            <HomeView
              currentUser={currentUser}
              setActiveTab={handleTabChange}
              places={explorePlaces}
              rentals={rentals}
              trips={travelTrips}
            />
          )}

          {activeTab === 'rentals' && (
            <RentalsView
              rentals={rentals}
              loading={rentalsLoading}
              error={rentalsError}
              currentUser={currentUser}
              onRefresh={refreshRentals}
              onRefreshRentals={refreshRentals}
            />
          )}

          {activeTab === 'vendor_portal' && (
            <VendorPortalView
              currentUser={currentUser}
              onRefreshRentals={refreshRentals}
              onAddRental={handleAddRental}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreView
              places={explorePlaces}
              currentUser={currentUser}
              onToggleBookmark={handleToggleBookmark}
              initialSearchQuery={exploreSearchQuery}
              onAddPlace={handleAddPlace}
            />
          )}

          {activeTab === 'planner' && (
            <TripPlannerView
              places={explorePlaces}
              currentUser={currentUser}
              onToggleBookmark={handleToggleBookmark}
            />
          )}

          {activeTab === 'travel' && (
            <TravelView
              trips={travelTrips}
              currentUser={currentUser}
              onRefreshTrips={fetchExploreAndTrips}
              onAddTrip={handleAddTrip}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              onLogout={handleLogout}
              places={explorePlaces}
            />
          )}
        </main>

        {/* Bottom Nav */}
        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} currentUser={currentUser} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
