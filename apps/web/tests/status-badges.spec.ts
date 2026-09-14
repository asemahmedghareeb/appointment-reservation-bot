import { describe, it, expect } from 'vitest';
import { BookingCaseStatus } from '@visaflow/shared-types';
import { getStatusConfig, STATUS_CONFIG } from '../lib/formatters/status';

describe('Status Badge Formatter', () => {
  it('should define configurations for all 17 canonical statuses', () => {
    const statuses = Object.values(BookingCaseStatus);
    expect(statuses).toHaveLength(17);

    for (const status of statuses) {
      const config = getStatusConfig(status);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.badgeClass).toBeTruthy();
      expect(config.color).toBeTruthy();
    }
  });

  it('should map critical operational statuses correctly', () => {
    expect(STATUS_CONFIG[BookingCaseStatus.DRAFT].badgeClass).toBe('badge-draft');
    expect(STATUS_CONFIG[BookingCaseStatus.READY].badgeClass).toBe('badge-ready');
    expect(STATUS_CONFIG[BookingCaseStatus.MONITORING].badgeClass).toBe('badge-monitoring');
    expect(STATUS_CONFIG[BookingCaseStatus.WAITING_QUEUE].badgeClass).toBe('badge-waiting_queue');
    expect(STATUS_CONFIG[BookingCaseStatus.SLOT_FOUND].badgeClass).toBe('badge-slot_found');
    expect(STATUS_CONFIG[BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED].badgeClass).toBe(
      'badge-human_verification_required',
    );
    expect(STATUS_CONFIG[BookingCaseStatus.PAYMENT_REQUIRED].badgeClass).toBe(
      'badge-payment_required',
    );
    expect(STATUS_CONFIG[BookingCaseStatus.CONFIRMED].badgeClass).toBe('badge-confirmed');
    expect(STATUS_CONFIG[BookingCaseStatus.FAILED].badgeClass).toBe('badge-failed');
  });

  it('should fallback gracefully for unknown statuses', () => {
    const fallback = getStatusConfig('UNKNOWN_STATUS' as any);
    expect(fallback.label).toBe('UNKNOWN_STATUS');
    expect(fallback.badgeClass).toBe('badge-draft');
  });
});
