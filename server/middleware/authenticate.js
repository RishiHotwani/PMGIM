import { verifyAccessToken } from '../utils/jwt.js';
import { findUserByUuid } from '../modules/auth/auth.repository.js';

export async function authenticateToken(req, res, next) {
  try {
    let token = null;

    // 1. Try reading from HttpOnly cookie
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } 
    // 2. Fallback to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Access token missing.'
      });
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token. Please refresh token or log in again.'
      });
    }

    const user = await findUserByUuid(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Authentication processing error.'
    });
  }
}
