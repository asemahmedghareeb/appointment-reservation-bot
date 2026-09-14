import { BookingCaseStatus } from '@visaflow/shared-types';

export interface StatusConfig {
  label: string;
  badgeClass: string;
  color: string;
  description: string;
}

export const STATUS_CONFIG: Record<BookingCaseStatus, StatusConfig> = {
  [BookingCaseStatus.DRAFT]: {
    label: 'Draft',
    badgeClass: 'badge-draft',
    color: '#94a3b8',
    description: 'Case created and pending readiness check',
  },
  [BookingCaseStatus.READY]: {
    label: 'Ready',
    badgeClass: 'badge-ready',
    color: '#3b82f6',
    description: 'Verified and queued for automation start',
  },
  [BookingCaseStatus.AUTHENTICATING]: {
    label: 'Authenticating',
    badgeClass: 'badge-authenticating',
    color: '#8b5cf6',
    description: 'Logging into visa provider portal',
  },
  [BookingCaseStatus.MONITORING]: {
    label: 'Monitoring',
    badgeClass: 'badge-monitoring',
    color: '#0ea5e9',
    description: 'Scanning provider for available appointment slots',
  },
  [BookingCaseStatus.WAITING_QUEUE]: {
    label: 'Waiting Queue',
    badgeClass: 'badge-waiting_queue',
    color: '#eab308',
    description: 'Holding position in provider waiting room',
  },
  [BookingCaseStatus.SLOT_FOUND]: {
    label: 'Slot Found',
    badgeClass: 'badge-slot_found',
    color: '#10b981',
    description: 'Appointment slot detected within target criteria',
  },
  [BookingCaseStatus.BOOKING]: {
    label: 'Booking',
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Executing slot reservation workflow',
  },
  [BookingCaseStatus.ADDING_APPLICANTS]: {
    label: 'Adding Applicants',
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Submitting applicant forms to provider',
  },
  [BookingCaseStatus.APPOINTMENT_SELECTED]: {
    label: 'Appointment Selected',
    badgeClass: 'badge-booking',
    color: '#3b82f6',
    description: 'Appointment slot locked and awaiting payment/confirmation',
  },
  [BookingCaseStatus.PAYMENT_REQUIRED]: {
    label: 'Payment Required',
    badgeClass: 'badge-payment_required',
    color: '#f59e0b',
    description: 'Provider requires manual payment completion',
  },
  [BookingCaseStatus.PAYMENT_PROCESSING]: {
    label: 'Payment Processing',
    badgeClass: 'badge-payment_required',
    color: '#f59e0b',
    description: 'Verifying payment status with provider',
  },
  [BookingCaseStatus.CONFIRMED]: {
    label: 'Confirmed',
    badgeClass: 'badge-confirmed',
    color: '#10b981',
    description: 'Appointment officially booked and confirmed',
  },
  [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED]: {
    label: 'Action Required',
    badgeClass: 'badge-human_verification_required',
    color: '#f97316',
    description: 'Operator intervention needed (2FA / OTP / Challenge)',
  },
  [BookingCaseStatus.SLOT_LOST]: {
    label: 'Slot Lost',
    badgeClass: 'badge-failed',
    color: '#ef4444',
    description: 'Selected slot was claimed by another party',
  },
  [BookingCaseStatus.EXPIRED]: {
    label: 'Expired',
    badgeClass: 'badge-failed',
    color: '#64748b',
    description: 'Target window passed without finding matching slot',
  },
  [BookingCaseStatus.FAILED]: {
    label: 'Failed',
    badgeClass: 'badge-failed',
    color: '#ef4444',
    description: 'Automation encountered an unrecoverable failure',
  },
  [BookingCaseStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeClass: 'badge-cancelled',
    color: '#64748b',
    description: 'Booking case cancelled by operator',
  },
};

export function getStatusConfig(status: BookingCaseStatus | string): StatusConfig {
  return (
    STATUS_CONFIG[status as BookingCaseStatus] ?? {
      label: status,
      badgeClass: 'badge-draft',
      color: '#94a3b8',
      description: '',
    }
  );
}
