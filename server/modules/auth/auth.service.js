import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  findUserByEmail,
  findUserByUuid,
  findUserById,
  findUserByGoogleId,
  createUser,
  updateUserLastLogin,
  incrementFailedLogin,
  updateUserPassword,
  updateUserVerification,
  storeRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens,
  storeAuthToken,
  findAuthToken,
  markAuthTokenUsed,
  softDeleteUser
} from './auth.repository.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../../utils/password.js';
import { generateAccessToken, generateRefreshTokenPayload, hashRefreshToken } from '../../utils/jwt.js';
import { verifyGoogleToken } from '../../utils/googleAuth.js';
import { logAuditActivity } from '../../utils/logger.js';

export function sanitizeUserDTO(user) {
  if (!user) return null;
  const userObj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete userObj.password_hash;
  delete userObj.passwordHash;
  delete userObj.deleted_at;
  delete userObj.failed_login_attempts;
  delete userObj.lock_until;
  return userObj;
}

export async function registerEmailUser({ name, email, password, batch, section, phone, role }, clientInfo) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    const err = new Error('An account with this email address already exists. Please log in.');
    err.statusCode = 409;
    throw err;
  }

  const passCheck = validatePasswordStrength(password);
  if (!passCheck.valid) {
    const err = new Error(passCheck.message);
    err.statusCode = 400;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'US';
  const userUuid = uuidv4();
  const userRole = (role === 'VENDOR' || role === 'ADMIN') ? role : 'USER';

  const user = await createUser({
    uuid: userUuid,
    name,
    email,
    passwordHash,
    provider: 'EMAIL',
    avatar: initials,
    emailVerified: false,
    role: userRole
  });

  const accessToken = generateAccessToken(user);
  const { rawToken, tokenHash } = generateRefreshTokenPayload();
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: clientInfo.userAgent,
    ipAddress: clientInfo.ip
  });

  await logAuditActivity(user.id, user.name, 'USER_SIGNUP', `Registered email account for ${user.email}`, { ip: clientInfo.ip });

  return { user: sanitizeUserDTO(user), accessToken, refreshToken: rawToken };
}

export async function loginEmailUser({ email, password }, clientInfo) {
  const user = await findUserByEmail(email);
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // OWASP ASVS: Check Account Lockout
  if (user.lock_until && new Date(user.lock_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lock_until) - new Date()) / (60 * 1000));
    const err = new Error(`Account is temporarily locked due to failed attempts. Try again in ${minutesLeft} minute(s).`);
    err.statusCode = 423;
    throw err;
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    const { newAttempts, lockTime } = await incrementFailedLogin(user.id, user.failed_login_attempts || 0);
    await logAuditActivity(user.id, user.name, 'FAILED_LOGIN', `Failed login attempt ${newAttempts}/5`, { ip: clientInfo.ip });
    
    if (lockTime) {
      const err = new Error('Account has been locked for 15 minutes due to multiple failed login attempts.');
      err.statusCode = 423;
      throw err;
    }
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  await updateUserLastLogin(user.id);

  const accessToken = generateAccessToken(user);
  const { rawToken, tokenHash } = generateRefreshTokenPayload();
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: clientInfo.userAgent,
    ipAddress: clientInfo.ip
  });

  await logAuditActivity(user.id, user.name, 'USER_LOGIN', `Email login successful for ${user.email}`, { ip: clientInfo.ip });

  return { user: sanitizeUserDTO(user), accessToken, refreshToken: rawToken };
}

export async function authenticateGoogleUser(idToken, clientInfo) {
  const googlePayload = await verifyGoogleToken(idToken);
  const { googleId, email, name, avatar, emailVerified } = googlePayload;

  let user = await findUserByGoogleId(googleId);

  if (!user) {
    user = await findUserByEmail(email);
    if (user) {
      // Link Google ID to existing email user
      user.google_id = googleId;
      user.provider = 'GOOGLE';
    } else {
      // Create new Google OAuth user
      const userUuid = uuidv4();
      user = await createUser({
        uuid: userUuid,
        name,
        email,
        googleId,
        provider: 'GOOGLE',
        avatar: avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'GO',
        emailVerified: emailVerified || true,
        role: 'USER'
      });
      await logAuditActivity(user.id, user.name, 'USER_GOOGLE_SIGNUP', `Created Google user ${user.email}`);
    }
  }

  await updateUserLastLogin(user.id);

  const accessToken = generateAccessToken(user);
  const { rawToken, tokenHash } = generateRefreshTokenPayload();
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: clientInfo.userAgent,
    ipAddress: clientInfo.ip
  });

  await logAuditActivity(user.id, user.name, 'USER_GOOGLE_LOGIN', `Google login successful for ${user.email}`, { ip: clientInfo.ip });

  return { user: sanitizeUserDTO(user), accessToken, refreshToken: rawToken };
}

export async function rotateRefreshToken(rawRefreshToken, clientInfo) {
  if (!rawRefreshToken) {
    throw new Error('Refresh token is required.');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const storedToken = await findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    throw new Error('Invalid or revoked refresh token.');
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    await revokeRefreshToken(tokenHash);
    throw new Error('Refresh token expired. Please log in again.');
  }

  // Token Rotation: Revoke old token and issue new token pair
  await revokeRefreshToken(tokenHash);
  const user = await findUserById(storedToken.user_id);

  const newAccessToken = generateAccessToken(user);
  const { rawToken: newRawRefresh, tokenHash: newRefreshHash } = generateRefreshTokenPayload();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await storeRefreshToken({
    userId: user.id,
    tokenHash: newRefreshHash,
    familyId: storedToken.family_id,
    expiresAt,
    userAgent: clientInfo.userAgent,
    ipAddress: clientInfo.ip
  });

  return { accessToken: newAccessToken, refreshToken: newRawRefresh, user: sanitizeUserDTO(user) };
}

export async function forgotPassword(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    // Return generic success to prevent email enumeration attacks (OWASP)
    return { success: true, message: 'If an account exists with this email, a password reset link has been sent.' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  await storeAuthToken({
    userId: user.id,
    tokenHash,
    type: 'PASSWORD_RESET',
    expiresAt
  });

  await logAuditActivity(user.id, user.name, 'PASSWORD_RESET_REQUESTED', `Password reset token generated for ${user.email}`);

  return {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
    resetToken: rawToken // Returned for API response / development
  };
}

export async function resetPassword(rawToken, newPassword) {
  const passCheck = validatePasswordStrength(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const authToken = await findAuthToken(tokenHash, 'PASSWORD_RESET');

  if (!authToken || new Date(authToken.expires_at) < new Date()) {
    throw new Error('Invalid or expired password reset token.');
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(authToken.user_id, passwordHash);
  await markAuthTokenUsed(authToken.id);
  await revokeAllUserTokens(authToken.user_id); // Invalidate all active sessions

  await logAuditActivity(authToken.user_id, 'User', 'PASSWORD_RESET_SUCCESS', 'Password successfully reset.');

  return { success: true, message: 'Password has been reset successfully. Please log in with your new password.' };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await findUserByUuid(userId);
  if (!user || !user.password_hash) {
    throw new Error('Password change not allowed for OAuth accounts.');
  }

  const isMatch = await comparePassword(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new Error('Incorrect current password.');
  }

  const passCheck = validatePasswordStrength(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  const newHash = await hashPassword(newPassword);
  await updateUserPassword(user.id, newHash);
  await revokeAllUserTokens(user.id); // Security: Revoke existing sessions

  await logAuditActivity(user.id, user.name, 'PASSWORD_CHANGE', 'User changed password.');

  return { success: true, message: 'Password changed successfully.' };
}

export async function logoutUser(rawRefreshToken) {
  if (rawRefreshToken) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await revokeRefreshToken(tokenHash);
  }
  return { success: true };
}

export async function logoutAllSessions(userId) {
  await revokeAllUserTokens(userId);
  return { success: true, message: 'Logged out from all active devices.' };
}
