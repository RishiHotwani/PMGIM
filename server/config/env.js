import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT || '3308', 10),
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || 'RishiHotwani27',
    NAME: process.env.DB_NAME || 'travelappgim',
  },

  JWT: {
    SECRET: process.env.JWT_SECRET || 'fallback_access_token_secret_pmgim_2026',
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_token_secret_pmgim_2026',
    ACCESS_EXPIRES_IN: '15m',
    REFRESH_EXPIRES_IN: '7d',
  },

  COOKIES: {
    SECRET: process.env.COOKIE_SECRET || 'cookie_secret_key_pmgim_2026',
    SAME_SITE: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    SECURE: process.env.NODE_ENV === 'production',
  },

  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '460937107777-5lifbfpuskp3bcfifv00f68bs2qib4k6.apps.googleusercontent.com',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  }
};
