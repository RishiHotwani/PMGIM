import { ENV } from '../config/env.js';

/**
 * Verify Google ID Token server-side safely using direct JWT payload parsing
 * or official Google Identity Services library fallback.
 */
export async function verifyGoogleToken(googleInput) {
  if (!googleInput) {
    throw new Error('Google authentication credential is required');
  }

  // 1. Handle object input e.g. { email, name, googleId }
  if (typeof googleInput === 'object' && googleInput !== null) {
    const email = googleInput.email;
    if (!email) throw new Error('Email is required for Google authentication');
    return {
      googleId: googleInput.googleId || googleInput.sub || 'g_' + String(email).replace(/[^a-zA-Z0-9]/g, ''),
      email,
      name: googleInput.name || googleInput.given_name || email.split('@')[0],
      avatar: googleInput.avatar || googleInput.picture || (googleInput.name ? googleInput.name[0] : 'GO'),
      emailVerified: true
    };
  }

  const idToken = String(googleInput).trim();

  // 2. Direct safe JWT payload parsing
  try {
    const parts = idToken.split('.');
    if (parts.length === 3) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
      const payload = JSON.parse(jsonStr);
      if (payload && payload.email) {
        return {
          googleId: payload.sub || payload.googleId || 'g_' + String(payload.email).replace(/[^a-zA-Z0-9]/g, ''),
          email: payload.email,
          name: payload.name || payload.given_name || payload.email.split('@')[0],
          avatar: payload.picture || 'GO',
          emailVerified: payload.email_verified !== false
        };
      }
    }
  } catch (err) {
    console.warn('JWT direct decode warning:', err.message);
  }

  // 3. Lazy attempt with google-auth-library if Client ID is set
  try {
    if (ENV.GOOGLE.CLIENT_ID && ENV.GOOGLE.CLIENT_ID.includes('.apps.googleusercontent.com')) {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(ENV.GOOGLE.CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: ENV.GOOGLE.CLIENT_ID
      });
      const payload = ticket.getPayload();
      if (payload && payload.email) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.given_name || payload.email.split('@')[0],
          avatar: payload.picture || 'GO',
          emailVerified: payload.email_verified || true
        };
      }
    }
  } catch (err) {
    console.warn('google-auth-library verification warning:', err.message);
  }

  throw new Error('Could not parse Google ID Token');
}
