import { NormalizationError } from './crypto.errors.js';

/**
 * Normalizes a passport number for consistent storage and lookup hashing.
 * Rules:
 * 1. Trim outer whitespace
 * 2. Convert to uppercase
 * 3. Remove ordinary internal whitespace (spaces, tabs, newlines)
 * 4. Preserve existing punctuation (e.g. hyphens if part of passport format)
 * 5. Reject empty result
 */
export function normalizePassportNumber(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new NormalizationError('Passport number must be a non-empty string');
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new NormalizationError('Passport number cannot be empty or solely whitespace');
  }

  // Remove internal whitespace and uppercase
  const normalized = trimmed.replace(/\s+/g, '').toUpperCase();

  if (normalized.length === 0) {
    throw new NormalizationError('Normalized passport number cannot be empty');
  }

  return normalized;
}
