import { describe, it, expect } from 'vitest';
import en from '../../messages/en.json';
import ar from '../../messages/ar.json';

function getDeepKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getDeepKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n Translation Key Parity', () => {
  const enKeys = getDeepKeys(en).sort();
  const arKeys = getDeepKeys(ar).sort();

  it('has identical number of translation keys in en.json and ar.json', () => {
    expect(arKeys.length).toBe(enKeys.length);
  });

  it('contains no missing keys in Arabic translation', () => {
    const missingInArabic = enKeys.filter((key) => !arKeys.includes(key));
    expect(missingInArabic).toEqual([]);
  });

  it('contains no unexpected keys in Arabic translation', () => {
    const missingInEnglish = arKeys.filter((key) => !enKeys.includes(key));
    expect(missingInEnglish).toEqual([]);
  });

  it('translates all 17 canonical booking statuses in both catalogs', () => {
    const canonicalStatuses = [
      'DRAFT',
      'READY',
      'AUTHENTICATING',
      'HUMAN_VERIFICATION_REQUIRED',
      'MONITORING',
      'WAITING_QUEUE',
      'SLOT_FOUND',
      'BOOKING',
      'ADDING_APPLICANTS',
      'APPOINTMENT_SELECTED',
      'PAYMENT_REQUIRED',
      'PAYMENT_PROCESSING',
      'CONFIRMED',
      'SLOT_LOST',
      'EXPIRED',
      'FAILED',
      'CANCELLED',
    ];

    for (const status of canonicalStatuses) {
      expect((en.statuses as any)[status]).toBeDefined();
      expect((ar.statuses as any)[status]).toBeDefined();
      expect((ar.statuses as any)[status]).not.toEqual((en.statuses as any)[status]);
    }
  });
});
