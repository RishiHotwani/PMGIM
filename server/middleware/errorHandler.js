import { ENV } from '../config/env.js';

/**
 * Standardized JSON Error Handler Middleware
 * Prevents leaks of stack traces, internal paths, and DB secrets in responses
 */
export function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const isProd = ENV.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: isProd && statusCode === 500 ? 'Internal Server Error' : err.message || 'An unexpected error occurred',
    ...(isProd ? {} : { stack: err.stack })
  });
}
