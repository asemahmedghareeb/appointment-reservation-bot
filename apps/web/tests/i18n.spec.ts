import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatAgeSeconds, formatRelativeTime } from '../lib/formatters/dates';
import { formatNumber, formatCurrency, formatPercent } from '../lib/formatters/numbers';

describe('Locale-Aware Formatters (i18n)', () => {
  const testIso = '2026-09-15T10:30:00.000Z';

  describe('Date formatting', () => {
    it('formats date according to English locale', () => {
      const formattedEn = formatDate(testIso, 'en');
      expect(formattedEn).toContain('2026');
      expect(formattedEn).toMatch(/Sep|September/);
    });

    it('formats date according to Arabic locale without breaking year', () => {
      const formattedAr = formatDate(testIso, 'ar');
      expect(formattedAr).toContain('2026');
      expect(formattedAr).toMatch(/سبتمبر/);
    });

    it('handles null/undefined gracefully with dash', () => {
      expect(formatDate(null, 'en')).toBe('—');
      expect(formatDate(undefined, 'ar')).toBe('—');
    });

    it('formats datetime according to locale', () => {
      const dtEn = formatDateTime(testIso, 'en');
      const dtAr = formatDateTime(testIso, 'ar');
      expect(dtEn).toContain('2026');
      expect(dtAr).toContain('2026');
    });

    it('formats age seconds in English and Arabic', () => {
      expect(formatAgeSeconds(30, 'en')).toBe('30s');
      expect(formatAgeSeconds(30, 'ar')).toBe('30ث');

      expect(formatAgeSeconds(90, 'en')).toBe('1m 30s');
      expect(formatAgeSeconds(90, 'ar')).toBe('1د 30ث');

      expect(formatAgeSeconds(3660, 'en')).toBe('1h 1m');
      expect(formatAgeSeconds(3660, 'ar')).toBe('1س 1د');
    });
  });

  describe('Number & Currency formatting', () => {
    it('formats numbers with standard numerals for consistency', () => {
      const numEn = formatNumber(12500.5, 'en');
      const numAr = formatNumber(12500.5, 'ar');
      expect(numEn).toBe('12,500.5');
      // Arabic uses latin numerals due to ar-u-nu-latn for clarity
      expect(numAr).toContain('12');
      expect(numAr).toContain('500');
    });

    it('formats currency preserving technical ISO code and values', () => {
      const curEn = formatCurrency(150, 'USD', 'en');
      const curAr = formatCurrency(150, 'USD', 'ar');
      expect(curEn).toContain('150');
      expect(curAr).toContain('150');
    });

    it('formats percentages correctly', () => {
      expect(formatPercent(0.85, 'en')).toBe('85%');
      expect(formatPercent(0.85, 'ar')).toContain('85');
    });
  });
});
