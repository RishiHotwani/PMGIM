import { query, isInMemoryFallback, memoryStore } from '../config/database.js';

/**
 * Audit Logger: Logs user activities safely into MySQL user_activities table.
 * Strictly redacts sensitive fields (passwords, JWTs, OAuth tokens, secrets).
 */
export async function logAuditActivity(userId, userName, activityType, description, details = {}) {
  try {
    // Sanitize details object to prevent logging passwords/tokens
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.password_hash;
    delete safeDetails.passwordHash;
    delete safeDetails.accessToken;
    delete safeDetails.refreshToken;
    delete safeDetails.idToken;
    delete safeDetails.token;
    delete safeDetails.credential;

    const detailsStr = typeof safeDetails === 'string' ? safeDetails : JSON.stringify(safeDetails);

    if (!isInMemoryFallback) {
      await query(
        'INSERT INTO user_activities (user_id, user_name, activity_type, description, details) VALUES (?, ?, ?, ?, ?)',
        [userId || null, userName || 'Guest', activityType, description, detailsStr]
      );
    } else {
      memoryStore.user_activities.unshift({
        id: memoryStore.user_activities.length + 1,
        user_id: userId || null,
        user_name: userName || 'Guest',
        activity_type: activityType,
        description,
        details: detailsStr,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
}
