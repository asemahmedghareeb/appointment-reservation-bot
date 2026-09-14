import { NormalizationError } from './crypto.errors.js';

/**
 * Masks a passport number to safely display in API responses without leaking the full identifier.
 * Example: "A1234567" -> "A12***67"
 */
export function maskPassportNumber(passportNumber: string): string {
  if (!passportNumber || typeof passportNumber !== 'string') {
    throw new NormalizationError('Passport number must be a non-empty string');
  }

  const trimmed = passportNumber.trim();
  if (trimmed.length === 0) {
    throw new NormalizationError('Passport number cannot be empty');
  }

  const len = trimmed.length;

  if (len <= 2) {
    return '*'.repeat(len);
  }

  if (len <= 4) {
    return `${trimmed[0]}${'*'.repeat(len - 2)}${trimmed[len - 1]}`;
  }

  let prefixLen = 3;
  let suffixLen = 2;

  if (len < 7) {
    prefixLen = 2;
    suffixLen = 2;
  }

  const maskedCount = len - prefixLen - suffixLen;
  return `${trimmed.slice(0, prefixLen)}${'*'.repeat(maskedCount)}${trimmed.slice(len - suffixLen)}`;
}
