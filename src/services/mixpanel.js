import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || 'demo-token-placeholder';
const ENABLED = Boolean(import.meta.env.VITE_MIXPANEL_TOKEN);

if (ENABLED) {
  mixpanel.init(TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    autocapture: true,
  });
} else {
  console.info('[Mixpanel] VITE_MIXPANEL_TOKEN not set — running in console-log mock mode. Set it in .env to enable dashboard impressions.');
}

function safeTrack(event, props = {}) {
  if (ENABLED) {
    try { mixpanel.track(event, props); } catch (e) { console.warn('[Mixpanel track error]', e.message); }
  } else {
    console.log(`[Mixpanel mock] ${event}`, props);
  }
}

export function initMixpanel() {
  if (ENABLED) safeTrack('App Loaded', { url: window.location.href });
}

export function identifyUser(user) {
  if (!user) return;
  const uid = String(user.id || user.uuid || user.email || 'guest');
  if (ENABLED) {
    try {
      mixpanel.identify(uid);
      mixpanel.people.set({
        $name: user.name,
        $email: user.email,
        role: user.role,
      });
    } catch {}
  }
  safeTrack('User Identified', { user_id: uid, role: user.role });
}

export function trackEvent(event, props) { safeTrack(event, props); }

export function trackPageView(page) { safeTrack('Page View', { page, url: window.location.href }); }

export default mixpanel;
