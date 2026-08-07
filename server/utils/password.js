import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hash password securely using bcrypt with cost factor 12 (OWASP ASVS V2.1)
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare candidate password with stored bcrypt hash
 */
export async function comparePassword(candidatePassword, storedHash) {
  if (!storedHash || !candidatePassword) return false;
  return await bcrypt.compare(candidatePassword, storedHash);
}

/**
 * Validate password strength against OWASP ASVS standards:
 * - Minimum 12 characters
 * - Uppercase letter
 * - Lowercase letter
 * - Number
 * - Special character
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, message: 'Password must be at least 12 characters long' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpper) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z)' };
  }
  if (!hasLower) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z)' };
  }
  if (!hasNumber) {
    return { valid: false, message: 'Password must contain at least one number (0-9)' };
  }
  if (!hasSpecial) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }

  return { valid: true, message: 'Strong password' };
}
