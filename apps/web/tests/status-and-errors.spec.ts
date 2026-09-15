import { describe, it, expect } from 'vitest';
import { BookingCaseStatus, ProviderCode } from '@visaflow/shared-types';
import enMessages from '../messages/en.json';
import arMessages from '../messages/ar.json';
import { getLocalizedErrorMessage, getStatusLabel } from '../lib/formatters/errors';

describe('Statuses, Errors & Domain Integrity (Phase 4.1)', () => {
  describe('Domain Enum Canonical Integrity', () => {
    it('preserves all 17 canonical BookingCaseStatus enum machine identifiers', () => {
      const expectedStatuses = [
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

      const actualValues = Object.values(BookingCaseStatus);
      expect(actualValues).toHaveLength(17);
      expect(actualValues.sort()).toEqual(expectedStatuses.sort());
    });

    it('does not contain any Arabic values inside domain enums', () => {
      const statuses = Object.values(BookingCaseStatus);
      for (const s of statuses) {
        expect(s).toMatch(/^[A-Z_]+$/);
      }
    });

    it('preserves canonical ProviderCode machine values', () => {
      expect(ProviderCode.VFS).toBe('VFS');
      expect(ProviderCode.TLS).toBe('TLS');
      expect(ProviderCode.BLS).toBe('BLS');
    });
  });

  describe('Status Translations Coverage', () => {
    it('has English and Arabic presentation translations for all 17 statuses', () => {
      const statuses = Object.values(BookingCaseStatus);
      for (const status of statuses) {
        const enLabel = (enMessages.statuses as Record<string, string>)[status];
        const arLabel = (arMessages.statuses as Record<string, string>)[status];

        expect(enLabel, `Missing EN status: ${status}`).toBeDefined();
        expect(enLabel?.length).toBeGreaterThan(0);

        expect(arLabel, `Missing AR status: ${status}`).toBeDefined();
        expect(arLabel?.length).toBeGreaterThan(0);
      }
    });

    it('maps specific key statuses to expected Arabic copy', () => {
      expect(arMessages.statuses.READY).toBe('جاهز');
      expect(arMessages.statuses.MONITORING).toBe('جاري البحث عن موعد');
      expect(arMessages.statuses.HUMAN_VERIFICATION_REQUIRED).toBe('يحتاج تدخل بشري');
      expect(arMessages.statuses.PAYMENT_REQUIRED).toBe('مطلوب الدفع');
      expect(arMessages.statuses.CONFIRMED).toBe('تم تأكيد الحجز');
    });

    it('formats status labels using getStatusLabel helper', () => {
      expect(getStatusLabel(BookingCaseStatus.READY, 'en')).toBe('Ready');
      expect(getStatusLabel(BookingCaseStatus.READY, 'ar')).toBe('جاهز');
      expect(getStatusLabel(BookingCaseStatus.CONFIRMED, 'ar')).toBe('تم تأكيد الحجز');
    });
  });

  describe('Error Localization Coverage', () => {
    const requiredErrorCodes = [
      'APPLICANT_ALREADY_EXISTS',
      'INVALID_PASSPORT_EXPIRY',
      'PROVIDER_ROUTE_NOT_FOUND',
      'PROVIDER_ROUTE_DISABLED',
      'BOOKING_CASE_NOT_FOUND',
      'BOOKING_CASE_NOT_DRAFT',
      'INVALID_PRIMARY_APPLICANT',
      'INVALID_APPLICANT_POSITION',
      'CASE_LOCK_CONFLICT',
      'HUMAN_RESUME_TARGET_MISMATCH',
      'AUTOMATION_SESSION_OWNER_MISMATCH',
      'VFS_PAGE_CHANGED',
      'UNEXPECTED_ERROR',
    ];

    it('has structured translations for all required error codes in both locales', () => {
      for (const code of requiredErrorCodes) {
        const enErr = (enMessages.errors as Record<string, string>)[code];
        const arErr = (arMessages.errors as Record<string, string>)[code];

        expect(enErr, `Missing EN error: ${code}`).toBeDefined();
        expect(arErr, `Missing AR error: ${code}`).toBeDefined();
      }
    });

    it('resolves error messages using getLocalizedErrorMessage helper', () => {
      const enMsg = getLocalizedErrorMessage('APPLICANT_ALREADY_EXISTS', 'en');
      const arMsg = getLocalizedErrorMessage('APPLICANT_ALREADY_EXISTS', 'ar');

      expect(enMsg).toContain('existing applicant');
      expect(arMsg).toContain('موجود');
    });

    it('falls back to localized unexpected error for unknown codes without leaking stack', () => {
      const enFallback = getLocalizedErrorMessage('RANDOM_UNKNOWN_CODE', 'en');
      const arFallback = getLocalizedErrorMessage('RANDOM_UNKNOWN_CODE', 'ar');

      expect(enFallback).toBe('An unexpected error occurred.');
      expect(arFallback).toBe('حدث خطأ غير متوقع.');
    });
  });
});
