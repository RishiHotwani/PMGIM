/**
 * rentalService.js — Centralized Rental API Service
 * 
 * Single source of truth for ALL rental data fetching.
 * Uses AbortController to cancel stale in-flight requests.
 * Uses request sequencing to discard out-of-order responses.
 * 
 * ARCHITECTURE:
 *   MySQL → Express API → rentalService → React State
 *   Never: React State → temporary array → maybe MySQL
 */

// AbortControllers for each endpoint family
let rentalsController = null;
let vendorFleetController = null;

// Request sequence counters to discard stale responses
let rentalsSeq = 0;
let vendorFleetSeq = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache',
  'Pragma': 'no-cache'
};

function getAuthHeaders(currentUser) {
  const token = (()=>{ try { return localStorage.getItem('gim_token'); } catch(e){ return null; } })();
  const headers = {
    'x-user-id': String(currentUser?.id || currentUser?.uuid || ''),
    'x-user-name': currentUser?.name || 'Vendor'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── PUBLIC RENTALS (read-only, no auth) ─────────────────────

export async function fetchAllRentals() {
  // Cancel any previous in-flight request
  if (rentalsController) {
    rentalsController.abort();
  }
  rentalsController = new AbortController();
  const thisSeq = ++rentalsSeq;

  try {
    const res = await fetch('/api/rentals', {
      signal: rentalsController.signal,
      headers: { ...NO_CACHE_HEADERS }
    });

    // Discard if a newer request was started while we were waiting
    if (thisSeq !== rentalsSeq) return null;

    if (!res.ok) {
      throw new Error(`GET /api/rentals failed: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[rentalService] fetchAllRentals aborted (superseded by newer request)');
      return null; // Caller should ignore null
    }
    console.error('[rentalService] fetchAllRentals error:', err.message);
    throw err;
  }
}

// ─── VENDOR FLEET (authenticated) ────────────────────────────

export async function fetchVendorFleet(currentUser) {
  if (vendorFleetController) {
    vendorFleetController.abort();
  }
  vendorFleetController = new AbortController();
  const thisSeq = ++vendorFleetSeq;

  try {
    const res = await fetch('/api/rentals/vendor', {
      signal: vendorFleetController.signal,
      credentials: 'include',
      headers: {
        ...NO_CACHE_HEADERS,
        ...getAuthHeaders(currentUser)
      }
    });

    if (thisSeq !== vendorFleetSeq) return null;

    if (!res.ok) {
      // Auto-retry once after silent refresh when token expired (15m)
      if (res.status === 401) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.accessToken) {
              try { localStorage.setItem('gim_token', refreshData.accessToken); } catch {}
              const retryRes = await fetch('/api/rentals/vendor', {
                headers: {
                  ...NO_CACHE_HEADERS,
                  ...getAuthHeaders(currentUser),
                  'Authorization': `Bearer ${refreshData.accessToken}`
                },
                credentials: 'include'
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                return Array.isArray(retryData) ? retryData : [];
              }
            }
          }
        } catch {}
      }
      throw new Error(`GET /api/rentals/vendor failed: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[rentalService] fetchVendorFleet aborted (superseded by newer request)');
      return null;
    }
    console.error('[rentalService] fetchVendorFleet error:', err.message);
    throw err;
  }
}

// ─── CREATE RENTAL (authenticated, VENDOR/ADMIN only) ────────

export async function createRental(currentUser, formData) {
  const res = await fetch('/api/rentals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...NO_CACHE_HEADERS,
      ...getAuthHeaders(currentUser)
    },
    body: JSON.stringify(formData)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || data.error?.message || 'Failed to save vehicle on server.');
  }

  const createdVehicle = data.rental || data.data;
  if (!createdVehicle || !createdVehicle.id) {
    throw new Error('Server returned success but no vehicle record with database ID.');
  }

  console.log('[rentalService] createRental success:', { id: createdVehicle.id, title: createdVehicle.title });
  return { vehicle: createdVehicle, message: data.message };
}

// ─── UPDATE RENTAL (authenticated) ──────────────────────────

export async function updateRental(currentUser, vehicleId, updates) {
  const res = await fetch(`/api/rentals/${vehicleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...NO_CACHE_HEADERS,
      ...getAuthHeaders(currentUser)
    },
    body: JSON.stringify(updates)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update vehicle.');
  }

  return data;
}

// ─── TOGGLE AVAILABILITY (authenticated) ────────────────────

export async function toggleAvailability(currentUser, vehicleId) {
  const res = await fetch(`/api/rentals/${vehicleId}/toggle`, {
    method: 'PATCH',
    headers: {
      ...NO_CACHE_HEADERS,
      ...getAuthHeaders(currentUser)
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to toggle vehicle availability.');
  }

  return data;
}

// ─── DELETE RENTAL (soft delete, authenticated) ─────────────

export async function deleteRental(currentUser, vehicleId) {
  const res = await fetch(`/api/rentals/${vehicleId}`, {
    method: 'DELETE',
    headers: {
      ...NO_CACHE_HEADERS,
      ...getAuthHeaders(currentUser)
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete vehicle.');
  }

  return data;
}

// ─── ABORT ALL (cleanup on unmount) ─────────────────────────

export function abortAll() {
  if (rentalsController) {
    rentalsController.abort();
    rentalsController = null;
  }
  if (vendorFleetController) {
    vendorFleetController.abort();
    vendorFleetController = null;
  }
}
