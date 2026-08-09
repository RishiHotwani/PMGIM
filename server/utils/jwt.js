import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../config/env.js';

/**
 * Generate short-lived Access Token (15 minutes)
 */
export function generateAccessToken(user) {
  const userUuid = user.uuid || user.id || user.email || 'user_' + Date.now();
  const payload = {
    sub: String(userUuid),
    id: user.id || 1,
    email: user.email || 'user@gim.ac.in',
    role: user.role || 'USER',
    provider: user.provider || 'EMAIL'
  };

  return jwt.sign(payload, ENV.JWT.SECRET, {
    expiresIn: ENV.JWT.ACCESS_EXPIRES_IN
  });
}

/**
 * Verify Access Token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ENV.JWT.SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Generate Refresh Token (7 days) & SHA-256 Hash for storage
 */
export function generateRefreshTokenPayload() {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Hash raw refresh token for comparison
 */
export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Attach secure HttpOnly authentication cookies to Express response
 */
export function setAuthCookies(res, accessToken, refreshToken) {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: ENV.COOKIES.SECURE,
      sameSite: ENV.COOKIES.SAME_SITE,
      path: '/'
    };

    if (typeof res.cookie === 'function') {
      res.cookie('access_token', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
      });

      if (refreshToken) {
        res.cookie('refresh_token', refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000
        });
      }
    }
  } catch (e) {
    console.warn('Cookie setting warning:', e.message);
  }
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res) {
  const cookieOptions = {
    httpOnly: true,
    secure: ENV.COOKIES.SECURE,
    sameSite: ENV.COOKIES.SAME_SITE,
    path: '/'
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
}
