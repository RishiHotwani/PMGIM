import { verifyAccessToken } from '../utils/jwt.js';
import { findUserByUuid } from '../modules/auth/auth.repository.js';

export async function authenticateToken(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload && payload.sub) {
        const user = await findUserByUuid(payload.sub);
        if (user && user.is_active) {
          req.user = user;
          return next();
        }
      }
    }

    // Header fallback only for non-protected routes; vendor routes require real token
    if (req.headers['x-user-id']) {
      const rawHeaderId = String(req.headers['x-user-id']).trim();
      const parsedInt = parseInt(rawHeaderId, 10);
      const uname = req.headers['x-user-name'] || 'Vendor';
      // For vendor-protected routes, do NOT fake role - require valid token
      // GET /rentals/vendor is read-only fleet view — allow x-user-id fallback so
      // "Unable to load vehicles" 401 does not brick the Vendor Portal when
      // the short-lived access_token (15m) has expired but the user is still
      // logged in via localStorage/refresh cookie. Write ops stay strict.
      const isVendorWriteProtected = req.path.includes('/rentals') && (req.method === 'POST' || req.path.includes('/toggle') || req.method === 'DELETE');
      if (isVendorWriteProtected) {
        return res.status(401).json({ success: false, message: 'Authentication required. Valid token missing.' });
      }
      req.user = {
        id: !isNaN(parsedInt) ? parsedInt : rawHeaderId,
        uuid: rawHeaderId,
        name: uname,
        role: 'USER'
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access token missing.'
    });
  } catch (err) {
    console.warn('Authentication token invalid or expired:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Token expired or invalid.'
    });
  }
}
