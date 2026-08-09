import { OAuth2Client } from 'google-auth-library';
import { ENV } from '../config/env.js';

let oauthClientInstance = null;

function getOAuthClient() {
  const clientId = ENV.GOOGLE.CLIENT_ID;
  if (!clientId || !clientId.includes('.apps.googleusercontent.com')) {
    console.error('[STAGE_FAIL: Google token verification] GOOGLE_CLIENT_ID missing or invalid in server environment.');
    const err = new Error('Google OAuth Client ID is misconfigured on the server.');
    err.statusCode = 500;
    throw err;
  }
  if (!oauthClientInstance) {
    oauthClientInstance = new OAuth2Client(clientId);
  }
  return { client: oauthClientInstance, clientId };
}

/**
 * Verify Google ID Token server-side using official Google Identity Services library.
 * Performs cryptographic signature verification against Google public keys
 * and validates audience (aud), issuer (iss), subject (sub), and email.
 */
export async function verifyGoogleToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    console.warn('[STAGE_FAIL: Google token verification] Invalid token input type or missing credential');
    const err = new Error('Google ID token credential is required');
    err.statusCode = 400;
    throw err;
  }

  const { client, clientId } = getOAuthClient();

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: clientId
    });

    const payload = ticket.getPayload();
    if (!payload) {
      console.warn('[STAGE_FAIL: Google token verification] Google ticket returned empty payload');
      const err = new Error('Invalid Google ID Token payload');
      err.statusCode = 401;
      throw err;
    }

    // Validate expected Google Issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      console.warn(`[STAGE_FAIL: Google token verification] Issuer mismatch: ${payload.iss}`);
      const err = new Error('Google ID token issuer mismatch');
      err.statusCode = 401;
      throw err;
    }

    // Validate required claims: sub & email
    if (!payload.sub || !payload.email) {
      console.warn('[STAGE_FAIL: Google token verification] Missing sub or email claims in payload');
      const err = new Error('Google ID token missing required identity claims');
      err.statusCode = 401;
      throw err;
    }

    const emailVerified = Boolean(payload.email_verified);

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      avatar: payload.picture || 'GO',
      emailVerified
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.warn(`[STAGE_FAIL: Google token verification] Cryptographic verification failed: ${err.message}`);
    const authErr = new Error('Google authentication verification failed. Invalid or expired token.');
    authErr.statusCode = 401;
    throw authErr;
  }
}
