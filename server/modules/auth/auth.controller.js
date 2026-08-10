import {
  registerEmailUser,
  loginEmailUser,
  loginPhoneUser,
  authenticateGoogleUser,
  rotateRefreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  logoutUser,
  logoutAllSessions,
  sanitizeUserDTO
} from './auth.service.js';
import { setAuthCookies, clearAuthCookies } from '../../utils/jwt.js';
import { findUserByUuid, updateUserProfile } from './auth.repository.js';
import { normalizePhoneNumber } from '../../utils/phone.js';

export async function handleSignup(req, res, next) {
  try {
    const clientInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { user, accessToken, refreshToken } = await registerEmailUser(req.body, clientInfo);

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user,
      accessToken
    });
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req, res, next) {
  try {
    const clientInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const identifier = req.body.identifier || req.body.email || req.body.phone;

    let result;
    if (req.body.phone || (identifier && /^[+\d\s\-\(\)]+$/.test(String(identifier).trim()) && !identifier.includes('@'))) {
      result = await loginPhoneUser({ phone: identifier || req.body.phone, password: req.body.password }, clientInfo);
    } else {
      result = await loginEmailUser({ email: identifier || req.body.email, password: req.body.password }, clientInfo);
    }

    const { user, accessToken, refreshToken } = result;
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
      user,
      accessToken
    });
  } catch (err) {
    next(err);
  }
}

export async function handlePhoneLogin(req, res, next) {
  try {
    const clientInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { user, accessToken, refreshToken } = await loginPhoneUser(req.body, clientInfo);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Phone login successful',
      user,
      accessToken
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGoogleAuth(req, res, next) {
  try {
    const body = req.body || {};
    const credentialInput = body.credential || body.idToken || (body.email ? body : null);

    if (!credentialInput) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication credential or account profile is required.'
      });
    }

    const clientInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { user, accessToken, refreshToken } = await authenticateGoogleUser(credentialInput, clientInfo);

    try {
      setAuthCookies(res, accessToken, refreshToken);
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Google authentication successful',
      user,
      accessToken
    });
  } catch (err) {
    console.error('[GOOGLE_AUTH_CONTROLLER_CATCH]', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'Google authentication failed.'
    });
  }
}

export async function handleRefreshToken(req, res, next) {
  try {
    const rawRefreshToken = req.cookies.refresh_token || req.body.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token missing.' });
    }

    const clientInfo = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { accessToken, refreshToken, user } = await rotateRefreshToken(rawRefreshToken, clientInfo);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      user,
      accessToken
    });
  } catch (err) {
    try { clearAuthCookies(res); } catch (e) {}
    return res.status(401).json({
      success: false,
      message: err.message || 'Invalid or expired refresh token.'
    });
  }
}

export async function handleForgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await forgotPassword(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleResetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const result = await resetPassword(token, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleChangePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(req.user.uuid, currentPassword, newPassword);
    clearAuthCookies(res);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleLogout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies.refresh_token;
    await logoutUser(rawRefreshToken);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    clearAuthCookies(res);
    next(err);
  }
}

export async function handleLogoutAll(req, res, next) {
  try {
    await logoutAllSessions(req.user.id);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out from all devices successfully' });
  } catch (err) {
    next(err);
  }
}

export async function handleGetMe(req, res, next) {
  try {
    res.json({
      success: true,
      user: sanitizeUserDTO(req.user)
    });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    let normPhone = null;
    if (phone) {
      normPhone = normalizePhoneNumber(phone);
      if (!normPhone) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
      }
    }

    const updatedUser = await updateUserProfile(req.user.uuid, { name, phone: normPhone });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUserDTO(updatedUser)
    });
  } catch (err) {
    next(err);
  }
}
