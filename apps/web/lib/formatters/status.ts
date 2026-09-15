import { BookingCaseStatus } from '@visaflow/shared-types';
import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';

export interface StatusConfig {
  label: string;
  badgeClass: string;
  color: string;
  description: string;
}

export const STATUS_CONFIG: Record<BookingCaseStatus, StatusConfig> = {
  [BookingCaseStatus.DRAFT]: {
    label: enMessages.statuses.DRAFT,
    badgeClass: 'badge-draft',
    color: '#94a3b8',
    description: 'Case created and pending readiness check',
  },
  [BookingCaseStatus.READY]: {
    label: enMessages.statuses.READY,
    badgeClass: 'badge-ready',
    color: '#3b82f6',
    description: 'Verified and queued for automation start',
  },
  [BookingCaseStatus.AUTHENTICATING]: {
    label: enMessages.statuses.AUTHENTICATING,
    badgeClass: 'badge-authenticating',
    color: '#8b5cf6',
    description: 'Logging into visa provider portal',
  },
  [BookingCaseStatus.MONITORING]: {
    label: enMessages.statuses.MONITORING,
    badgeClass: 'badge-monitoring',
    color: '#0ea5e9',
    description: 'Scanning provider for available appointment slots',
  },
  [BookingCaseStatus.WAITING_QUEUE]: {
    label: enMessages.statuses.WAITING_QUEUE,
    badgeClass: 'badge-waiting_queue',
    color: '#eab308',
    description: 'Holding position in provider waiting room',
  },
  [BookingCaseStatus.SLOT_FOUND]: {
    label: enMessages.statuses.SLOT_FOUND,
    badgeClass: 'badge-slot_found',
    color: '#10b981',
    description: 'Appointment slot detected within target criteria',
  },
  [BookingCaseStatus.BOOKING]: {
    label: enMessages.statuses.BOOKING,
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Executing slot reservation workflow',
  },
  [BookingCaseStatus.ADDING_APPLICANTS]: {
    label: enMessages.statuses.ADDING_APPLICANTS,
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Submitting applicant forms to provider',
  },
  [BookingCaseStatus.APPOINTMENT_SELECTED]: {
    label: enMessages.statuses.APPOINTMENT_SELECTED,
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Appointment slot locked and awaiting payment/confirmation',
  },
  [BookingCaseStatus.PAYMENT_REQUIRED]: {
    label: enMessages.statuses.PAYMENT_REQUIRED,
    badgeClass: 'badge-payment_required',
    color: '#f59e0b',
    description: 'Provider requires manual payment completion',
  },
  [BookingCaseStatus.PAYMENT_PROCESSING]: {
    label: enMessages.statuses.PAYMENT_PROCESSING,
    badgeClass: 'badge-payment_required',
    color: '#f59e0b',
    description: 'Verifying payment status with provider',
  },
  [BookingCaseStatus.CONFIRMED]: {
    label: enMessages.statuses.CONFIRMED,
    badgeClass: 'badge-confirmed',
    color: '#10b981',
    description: 'Appointment officially booked and confirmed',
  },
  [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED]: {
    label: enMessages.statuses.HUMAN_VERIFICATION_REQUIRED,
    badgeClass: 'badge-human_verification_required',
    color: '#f97316',
    description: 'Operator intervention needed (2FA / OTP / Challenge)',
  },
  [BookingCaseStatus.SLOT_LOST]: {
    label: enMessages.statuses.SLOT_LOST,
    badgeClass: 'badge-failed',
    color: '#ef4444',
    description: 'Selected slot was claimed by another party',
  },
  [BookingCaseStatus.EXPIRED]: {
    label: enMessages.statuses.EXPIRED,
    badgeClass: 'badge-failed',
    color: '#64748b',
    description: 'Target window passed without finding matching slot',
  },
  [BookingCaseStatus.FAILED]: {
    label: enMessages.statuses.FAILED,
    badgeClass: 'badge-failed',
    color: '#ef4444',
    description: 'Automation encountered an unrecoverable failure',
  },
  [BookingCaseStatus.CANCELLED]: {
    label: enMessages.statuses.CANCELLED,
    badgeClass: 'badge-cancelled',
    color: '#64748b',
    description: 'Booking case cancelled by operator',
  },
};

export function getStatusConfig(
  status: BookingCaseStatus | string,
  locale = 'en',
): StatusConfig {
  const baseConfig = STATUS_CONFIG[status as BookingCaseStatus] ?? {
    label: status,
    badgeClass: 'badge-draft',
    color: '#94a3b8',
    description: '',
  };

  if (locale === 'ar') {
    const arLabel = (arMessages.statuses as Record<string, string>)[status];
    if (arLabel) {
      return {
        ...baseConfig,
        label: arLabel,
      };
    }
  }

  return baseConfig;
}
