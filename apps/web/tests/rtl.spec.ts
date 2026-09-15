import { describe, it, expect } from 'vitest';
import { getDirection, isRtl } from '../lib/locale/direction';
import { locales, defaultLocale, isValidLocale } from '../i18n/config';

describe('RTL and Direction Utilities', () => {
  it('identifies RTL correctly for Arabic and English', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('returns correct dir attribute values', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');
  });

  it('validates configured locales', () => {
    expect(locales).toEqual(['en', 'ar']);
    expect(defaultLocale).toBe('en');
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('ar')).toBe(true);
    expect(isValidLocale('fr')).toBe(false);
    expect(isValidLocale('')).toBe(false);
  });
});
