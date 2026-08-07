import { query, isInMemoryFallback, memoryStore } from '../../config/database.js';

export async function findUserByEmail(email) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
      return rows[0] || null;
    } catch (e) {
      const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0] || null;
    }
  }
  return memoryStore.users.find(u => u.email === email && !u.deleted_at) || null;
}

export async function findUserByUuid(uuid) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM users WHERE uuid = ? AND deleted_at IS NULL', [uuid]);
      return rows[0] || null;
    } catch (e) {
      const rows = await query('SELECT * FROM users WHERE uuid = ?', [uuid]);
      return rows[0] || null;
    }
  }
  return memoryStore.users.find(u => u.uuid === uuid && !u.deleted_at) || null;
}

export async function findUserById(id) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
      return rows[0] || null;
    } catch (e) {
      const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    }
  }
  return memoryStore.users.find(u => u.id === parseInt(id, 10) && !u.deleted_at) || null;
}

export async function findUserByGoogleId(googleId) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM users WHERE google_id = ? AND deleted_at IS NULL', [googleId]);
      return rows[0] || null;
    } catch (e) {
      const rows = await query('SELECT * FROM users WHERE google_id = ?', [googleId]);
      return rows[0] || null;
    }
  }
  return memoryStore.users.find(u => u.google_id === googleId && !u.deleted_at) || null;
}

export async function createUser(userData) {
  const { uuid, name, email, passwordHash, googleId, provider, avatar, emailVerified, role } = userData;

  if (!isInMemoryFallback) {
    try {
      await query(
        `INSERT INTO users (uuid, name, email, password_hash, google_id, provider, avatar, email_verified, role) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid,
          name,
          email,
          passwordHash || null,
          googleId || null,
          provider || 'EMAIL',
          avatar || 'US',
          emailVerified ? 1 : 0,
          role || 'USER'
        ]
      );
    } catch (e) {
      // Fallback for pre-existing simpler users table schema
      await query(
        `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
        [name, email, passwordHash || '']
      );
    }
    return await findUserByEmail(email);
  }

  const newUser = {
    id: memoryStore.users.length + 1,
    uuid,
    name,
    email,
    password_hash: passwordHash || null,
    google_id: googleId || null,
    provider: provider || 'EMAIL',
    avatar: avatar || 'US',
    email_verified: emailVerified || false,
    role: role || 'USER',
    is_active: true,
    failed_login_attempts: 0,
    lock_until: null,
    last_login: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null
  };
  memoryStore.users.push(newUser);
  return newUser;
}

export async function updateUserLastLogin(userId) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0, lock_until = NULL WHERE id = ?', [userId]);
    } catch (e) {}
  }
}

export async function incrementFailedLogin(userId, currentAttempts) {
  const newAttempts = currentAttempts + 1;
  const lockTime = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

  if (!isInMemoryFallback) {
    try {
      await query(
        'UPDATE users SET failed_login_attempts = ?, lock_until = ? WHERE id = ?',
        [newAttempts, lockTime, userId]
      );
    } catch (e) {}
  }
  return { newAttempts, lockTime };
}

export async function updateUserPassword(userId, passwordHash) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE users SET password_hash = ?, failed_login_attempts = 0, lock_until = NULL WHERE id = ?', [passwordHash, userId]);
    } catch (e) {
      await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    }
  }
}

export async function updateUserVerification(userId) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE users SET email_verified = TRUE WHERE id = ?', [userId]);
    } catch (e) {}
  }
}

export async function storeRefreshToken({ userId, tokenHash, familyId, expiresAt, userAgent, ipAddress }) {
  if (!isInMemoryFallback) {
    try {
      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, tokenHash, familyId, expiresAt, userAgent || '', ipAddress || '']
      );
    } catch (e) {}
  }
}

export async function findRefreshTokenByHash(tokenHash) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND is_revoked = FALSE', [tokenHash]);
      return rows[0] || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function revokeRefreshToken(tokenHash) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = ?', [tokenHash]);
    } catch (e) {}
  }
}

export async function revokeTokenFamily(familyId) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = ?', [familyId]);
    } catch (e) {}
  }
}

export async function revokeAllUserTokens(userId) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [userId]);
    } catch (e) {}
  }
}

export async function storeAuthToken({ userId, tokenHash, type, expiresAt }) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE auth_tokens SET used = TRUE WHERE user_id = ? AND type = ?', [userId, type]);
      await query(
        'INSERT INTO auth_tokens (user_id, token_hash, type, expires_at) VALUES (?, ?, ?, ?)',
        [userId, tokenHash, type, expiresAt]
      );
    } catch (e) {}
  }
}

export async function findAuthToken(tokenHash, type) {
  if (!isInMemoryFallback) {
    try {
      const rows = await query('SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ? AND used = FALSE', [tokenHash, type]);
      return rows[0] || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function markAuthTokenUsed(id) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE auth_tokens SET used = TRUE WHERE id = ?', [id]);
    } catch (e) {}
  }
}

export async function softDeleteUser(userId) {
  if (!isInMemoryFallback) {
    try {
      await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE WHERE id = ?', [userId]);
    } catch (e) {
      await query('DELETE FROM users WHERE id = ?', [userId]);
    }
  }
}
