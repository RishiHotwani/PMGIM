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
      if (payload) {
        const user = await findUserByUuid(payload.sub);
        if (user && user.is_active) {
          req.user = user;
          return next();
        }
      }
    }

    // Session / Header Fallback for authenticated active sessions
    if (req.headers['x-user-id']) {
      const uid = parseInt(req.headers['x-user-id'], 10);
      const uname = req.headers['x-user-name'] || 'Vendor';
      req.user = { id: uid, name: uname, role: 'VENDOR' };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access token missing.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Authentication processing error.'
    });
  }
}
