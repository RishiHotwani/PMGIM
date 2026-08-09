import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Authentication Endpoints (Login, Signup, Reset Password)
 * Bypassed gracefully on Vercel serverless to prevent proxy IP validation throws.
 */
export const authRateLimiter = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      message: {
        success: false,
        message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      }
    });

/**
 * Global Rate Limiter for API Routes
 */
export const globalRateLimiter = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      message: {
        success: false,
        message: 'Rate limit exceeded. Please slow down requests.'
      }
    });
