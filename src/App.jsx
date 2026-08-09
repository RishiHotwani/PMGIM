import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import RentalsView from './views/RentalsView';
import ExploreView from './views/ExploreView';
import TravelView from './views/TravelView';
import ProfileView from './views/ProfileView';
import AuthGateView from './views/AuthGateView';
import VendorPortalView from './views/VendorPortalView';
import AdminAnalyticsView from './views/AdminAnalyticsView';
import { AuthProvider, useAuth } from './context/AuthContext';
import * as rentalService from './services/rentalService';
import { DEFAULT_EXPLORE_PLACES } from './data/defaultPlaces';
import { DEFAULT_TRAVEL_TRIPS } from './data/defaultTrips';
import { DEFAULT_RENTALS } from './data/defaultRentals';

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
        setRentals((prev) => {
          const map = new Map();
          // Remote data first
          data.forEach((r) => map.set(String(r.id), r));
          // Preserve any locally created rentals in prev state if backend propagation is in-flight
          (prev || []).forEach((r) => {
            if (!map.has(String(r.id))) {
              map.set(String(r.id), r);
            }
          });
          return Array.from(map.values());
        });
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
          setExplorePlaces(data);
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
        headers: { 'Cache-Control': 'no-store' }
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTravelTrips((prev) => {
            const map = new Map();
            // Backend data first
            data.forEach((t) => map.set(String(t.id), t));
            // Preserve locally added trips if backend insert is propagating
            (prev || []).forEach((t) => {
              if (!map.has(String(t.id))) {
                map.set(String(t.id), t);
              }
            });
            return Array.from(map.values());
          });
        }
      }
    } catch (err) {
      console.error('[App] fetchTravelTrips error:', err.message);
    }
  }, []);

  const handleAddTrip = useCallback((newTrip) => {
    setTravelTrips((prev) => [newTrip, ...prev.filter((t) => String(t.id) !== String(newTrip.id))]);
  }, []);

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

  // Log user action to backend
  const handleLogAction = async (type, description, details = '') => {
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'User'
        },
        body: JSON.stringify({
          userId: currentUser?.id || null,
          userName: currentUser?.name || 'Guest',
          type,
          description,
          details
        })
      });
    } catch (err) {
      console.error('Log activity error:', err);
    }
  };

  const [exploreSearchQuery, setExploreSearchQuery] = useState('');

  // ─── TAB CHANGE (NO fetchData call — no double-fetch) ───────
  const handleTabChange = (newTab, queryParam = '') => {
    handleLogAction('SWITCH_TAB', `Switched active tab to: ${newTab}`);
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
              onLogAction={handleLogAction}
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
              onLogAction={handleLogAction}
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

          {activeTab === 'analytics' && (
            <AdminAnalyticsView />
          )}

          {activeTab === 'explore' && (
            <ExploreView
              places={explorePlaces}
              onLogAction={handleLogAction}
              currentUser={currentUser}
              onToggleBookmark={handleToggleBookmark}
              initialSearchQuery={exploreSearchQuery}
            />
          )}

          {activeTab === 'travel' && (
            <TravelView
              trips={travelTrips}
              onLogAction={handleLogAction}
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
              onLogAction={handleLogAction}
            />
          )}
        </main>

        {/* Bottom Nav */}
        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
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
