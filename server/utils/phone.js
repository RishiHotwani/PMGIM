/**
 * phone.js — Server-side Phone Normalization and Validation Utility
 */

export function normalizePhoneNumber(phone) {
  if (!phone) return null;
  // Remove spaces, hyphens, parentheses, dots
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '').trim();

  // Handle leading zero e.g. 09876543210 -> 9876543210
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Handle +91 prefix for Indian numbers
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // Validate 10-digit number format
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return null;
  }

  return `+91${cleaned}`;
}

export function validatePhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  return Boolean(normalized);
}
