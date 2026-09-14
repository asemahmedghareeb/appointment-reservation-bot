import { createHmac } from 'node:crypto';
import { HMAC_ALGORITHM } from './crypto.constants.js';
import { normalizePassportNumber } from './normalization.js';
import { CryptoError } from './crypto.errors.js';
import { getEnv } from '@visaflow/config';

function resolvePepper(pepperOverride?: string): string {
  let pepper = pepperOverride;

  if (pepper === undefined) {
    pepper = process.env.PASSPORT_LOOKUP_PEPPER;
    if (!pepper) {
      try {
        pepper = getEnv().PASSPORT_LOOKUP_PEPPER;
      } catch {
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
          pepper = 'test_pepper_at_least_16_chars';
        }
      }
    }
  }

  if (!pepper || typeof pepper !== 'string' || pepper.length < 16) {
    throw new CryptoError(
      'PASSPORT_LOOKUP_PEPPER must be a non-empty string with at least 16 characters',
    );
  }

  return pepper;
}

/**
 * Creates a deterministic, searchable HMAC-SHA256 digest of a normalized passport number.
 * Ensures passports can be queried without exposing plaintext or relying on vulnerable reversible ciphers.
 */
export function createPassportLookupHash(
  passportNumber: string,
  pepperOverride?: string,
): string {
  const normalized = normalizePassportNumber(passportNumber);
  const pepper = resolvePepper(pepperOverride);

  return createHmac(HMAC_ALGORITHM, pepper)
    .update(normalized, 'utf8')
    .digest('hex');
}
