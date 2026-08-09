import { Router } from 'express';
import { body } from 'express-validator';
import {
  handleSignup,
  handleLogin,
  handlePhoneLogin,
  handleGoogleAuth,
  handleRefreshToken,
  handleForgotPassword,
  handleResetPassword,
  handleChangePassword,
  handleLogout,
  handleLogoutAll,
  handleGetMe,
  handleUpdateProfile
} from './auth.controller.js';
import { authenticateToken } from '../../middleware/authenticate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { handleValidationErrors } from '../../middleware/validate.js';

const router = Router();

// Validation Rules
const signupValidation = [
  body('name').trim().notEmpty().withMessage('Full Name is required'),
  body('email').trim().isEmail().withMessage('Valid GIM email address is required').normalizeEmail(),
  body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters long'),
  handleValidationErrors
];

const loginValidation = [
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const phoneLoginValidation = [
  body('phone').trim().notEmpty().withMessage('Mobile phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const forgotPasswordValidation = [
  body('email').trim().isEmail().withMessage('Valid email address is required').normalizeEmail(),
  handleValidationErrors
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 12 }).withMessage('New password must be at least 12 characters long'),
  handleValidationErrors
];

// Public Authentication Endpoints
router.post('/signup', authRateLimiter, signupValidation, handleSignup);
router.post('/login', authRateLimiter, loginValidation, handleLogin);
router.post('/login-phone', authRateLimiter, phoneLoginValidation, handlePhoneLogin);
router.post('/google', authRateLimiter, handleGoogleAuth);
router.post('/google/callback', authRateLimiter, handleGoogleAuth);
router.post('/refresh', handleRefreshToken);
router.post('/forgot-password', authRateLimiter, forgotPasswordValidation, handleForgotPassword);
router.post('/reset-password', authRateLimiter, resetPasswordValidation, handleResetPassword);

// Protected Authentication Endpoints
router.post('/logout', authenticateToken, handleLogout);
router.post('/logout-all', authenticateToken, handleLogoutAll);
router.post('/change-password', authenticateToken, handleChangePassword);
router.get('/me', authenticateToken, handleGetMe);
router.patch('/profile', authenticateToken, handleUpdateProfile);

export default router;
