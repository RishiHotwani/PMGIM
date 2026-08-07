import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Authentication Endpoints (Login, Signup, Reset Password)
 * Prevents Brute-Force & Credential Stuffing attacks (OWASP ASVS V2.2)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Global Rate Limiter for API Routes
 */
export const globalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please slow down requests.'
  }
});
