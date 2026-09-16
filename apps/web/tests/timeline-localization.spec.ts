import { describe, it, expect } from 'vitest';
import { formatTimelineEvent } from '../lib/formatters/timeline';
import { BookingCaseStatus } from '@visaflow/shared-types';

describe('Timeline Event Localization', () => {
  it('localizes state transitions into Arabic', () => {
    const item = {
      id: 'sh-1',
      timestamp: new Date().toISOString(),
      type: 'STATE_TRANSITION',
      title: 'Status changed to AUTHENTICATING',
      description: 'Worker beginning provider authentication',
      toStatus: BookingCaseStatus.AUTHENTICATING,
    };

    const arResult = formatTimelineEvent(item as any, 'ar');
    expect(arResult.title).toBe('تغيرت الحالة إلى جاري تسجيل الدخول');
    expect(arResult.description).toBe('بدء تسجيل الدخول والمصادقة مع مزود الخدمة');

    const enResult = formatTimelineEvent(item as any, 'en');
    expect(enResult.title).toBe('Status changed to AUTHENTICATING');
    expect(enResult.description).toBe('Worker beginning provider authentication');
  });

  it('localizes case status transitions into Arabic', () => {
    const item = {
      id: 'act-1',
      timestamp: new Date().toISOString(),
      type: 'CASE_STATUS_TRANSITIONED',
      title: 'Case status transitioned from READY to AUTHENTICATING',
    };

    const arResult = formatTimelineEvent(item as any, 'ar');
    expect(arResult.title).toBe('انتقلت حالة الحجز من جاهز إلى جاري تسجيل الدخول');
  });

  it('localizes booking case ready transition into Arabic', () => {
    const item = {
      id: 'act-2',
      timestamp: new Date().toISOString(),
      type: 'BOOKING_CASE_READY',
      title: 'Booking case VF_MU3VDHB1_918230E9 transitioned from DRAFT to READY',
    };

    const arResult = formatTimelineEvent(item as any, 'ar');
    expect(arResult.title).toBe('انتقل الحجز VF_MU3VDHB1_918230E9 من مسودة إلى جاهز');
  });

  it('localizes route inspection completion description', () => {
    const item = {
      id: 'sh-2',
      timestamp: new Date().toISOString(),
      type: 'STATE_TRANSITION',
      title: 'Status changed to MONITORING',
      description: 'Authentication and route inspection completed successfully',
      toStatus: BookingCaseStatus.MONITORING,
    };

    const arResult = formatTimelineEvent(item as any, 'ar');
    expect(arResult.title).toBe('تغيرت الحالة إلى جاري البحث عن موعد');
    expect(arResult.description).toBe('تم تسجيل الدخول وفحص مسار التأشيرة بنجاح');
  });
});
