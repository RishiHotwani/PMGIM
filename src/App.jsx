import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import RentalsView from './views/RentalsView';
import ExploreView from './views/ExploreView';
import TravelView from './views/TravelView';
import ProfileView from './views/ProfileView';
import AuthGateView from './views/AuthGateView';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  // Load stored user session if available, otherwise null to ask for SignUp/Login first!
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gim_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [rentals, setRentals] = useState([]);
  const [explorePlaces, setExplorePlaces] = useState([]);
  const [travelTrips, setTravelTrips] = useState([]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [rRes, eRes, tRes] = await Promise.all([
        fetch('/api/rentals'),
        fetch('/api/explore'),
        fetch('/api/trips')
      ]);

      if (rRes.ok) setRentals(await rRes.json());
      if (eRes.ok) setExplorePlaces(await eRes.json());
      if (tRes.ok) setTravelTrips(await tRes.json());
    } catch (err) {
      console.error('API fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Function to log any user action to MySQL database table in the backend
  const handleLogAction = async (type, description, details = '') => {
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleTabChange = (newTab) => {
    handleLogAction('SWITCH_TAB', `Switched active tab to: ${newTab}`);
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleBookmark = async (id) => {
    try {
      setExplorePlaces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p))
      );
      await fetch(`/api/explore/${id}/bookmark`, {
        method: 'POST',
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-name': currentUser?.name || 'User'
        }
      });
    } catch (err) {
      console.error('Toggle bookmark error:', err);
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('gim_user_session', JSON.stringify(user));
    } catch (e) {
      console.error('Error saving session:', e);
    }
  };

  const handleLogout = () => {
    handleLogAction('USER_LOGOUT', `User ${currentUser?.name} logged out`);
    setCurrentUser(null);
    try {
      localStorage.removeItem('gim_user_session');
    } catch (e) {
      console.error('Error clearing session:', e);
    }
  };

  // If no user is logged in, show AuthGateView (asking for Sign Up / Login / Google OAuth first!)
  if (!currentUser) {
    return <AuthGateView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      <div className="app-container w-full min-h-screen flex flex-col">
        {/* Top Header Bar */}
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
        />

        {/* Main View Content */}
        <main className="flex-1 w-full">
          {activeTab === 'home' && (
            <HomeView
              currentUser={currentUser}
              setActiveTab={handleTabChange}
              onLogAction={handleLogAction}
              places={explorePlaces}
            />
          )}

          {activeTab === 'rentals' && (
            <RentalsView
              rentals={rentals}
              onLogAction={handleLogAction}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreView
              places={explorePlaces}
              onLogAction={handleLogAction}
              onToggleBookmark={handleToggleBookmark}
            />
          )}

          {activeTab === 'travel' && (
            <TravelView
              trips={travelTrips}
              onLogAction={handleLogAction}
              currentUser={currentUser}
              onRefreshTrips={fetchData}
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

        {/* Sticky Bottom Navigation Bar (Visible on mobile screens) */}
        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
      </div>
    </div>
  );
}
