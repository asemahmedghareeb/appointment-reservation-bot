import { describe, it, expect } from 'vitest';
import { createPassportLookupHash } from './searchable-hash.service.js';
import { normalizePassportNumber } from './normalization.js';
import { NormalizationError, CryptoError } from './crypto.errors.js';

describe('Searchable Passport Hash & Normalization Service', () => {
  const pepperA = 'super-secret-pepper-for-tests-12345';
  const pepperB = 'completely-different-pepper-67890';

  it('normalizes passport strings correctly', () => {
    expect(normalizePassportNumber(' a123 456 ')).toBe('A123456');
    expect(normalizePassportNumber('a123456')).toBe('A123456');
    expect(normalizePassportNumber('N123-456')).toBe('N123-456');
    expect(normalizePassportNumber('  ab-99  00 \t ')).toBe('AB-9900');
  });

  it('throws NormalizationError on empty or whitespace-only inputs', () => {
    expect(() => normalizePassportNumber('')).toThrow(NormalizationError);
    expect(() => normalizePassportNumber('   ')).toThrow(NormalizationError);
  });

  it('generates identical hash for differently formatted versions of the same passport', () => {
    const hash1 = createPassportLookupHash('A123456', pepperA);
    const hash2 = createPassportLookupHash('a123456', pepperA);
    const hash3 = createPassportLookupHash(' A123 456 ', pepperA);
    const hash4 = createPassportLookupHash('\ta123 456\n', pepperA);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
    expect(hash3).toBe(hash4);
  });

  it('guarantees deterministic digest for same passport and same pepper', () => {
    const hash1 = createPassportLookupHash('P98765432', pepperA);
    const hash2 = createPassportLookupHash('P98765432', pepperA);

    expect(hash1).toBe(hash2);
  });

  it('enforces pepper isolation: different peppers produce different hashes', () => {
    const hashA = createPassportLookupHash('A123456', pepperA);
    const hashB = createPassportLookupHash('A123456', pepperB);

    expect(hashA).not.toBe(hashB);
  });

  it('throws error when pepper is invalid or too short', () => {
    expect(() => createPassportLookupHash('A123456', 'short')).toThrow(CryptoError);
    expect(() => createPassportLookupHash('A123456', '')).toThrow(CryptoError);
  });
});
