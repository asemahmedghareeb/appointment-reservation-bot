import type { BookingCaseStatus } from '../enums/booking-case-status.enum.js';
import type { ProviderCode } from '../enums/provider-code.enum.js';

export enum OperationsEventType {
  CASE_CREATED = 'CASE_CREATED',
  CASE_UPDATED = 'CASE_UPDATED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_ATTENTION_REQUIRED = 'CASE_ATTENTION_REQUIRED',
  AUTOMATION_SESSION_UPDATED = 'AUTOMATION_SESSION_UPDATED',
  PAYMENT_HANDOFF_UPDATED = 'PAYMENT_HANDOFF_UPDATED',
  CASE_CONFIRMED = 'CASE_CONFIRMED',
  NOTIFICATION_CREATED = 'NOTIFICATION_CREATED',
}

export interface OperationsEvent<T = unknown> {
  version: 1;
  eventId: string;
  type: OperationsEventType;
  occurredAt: string;
  caseId?: string | undefined;
  data: T;
}

export interface DashboardCounts {
  total: number;
  monitoring: number;
  waitingQueue: number;
  slotFound: number;
  paymentRequired: number;
  confirmed: number;
  needAttention: number;
}

export interface AttentionItem {
  caseId: string;
  caseNumber: string;
  provider: ProviderCode;
  destination: string;
  centre: string;
  reason: string;
  currentStatus: BookingCaseStatus;
  humanActionType?: string | undefined;
  ageSeconds: number;
  triggeredAt: string;
}

export interface RecentActivityItem {
  id: string;
  caseId?: string | undefined;
  caseNumber?: string | undefined;
  eventType: string;
  message: string;
  timestamp: string;
}

export interface DashboardSummary {
  counts: DashboardCounts;
  recentActivity: RecentActivityItem[];
  attentionItems: AttentionItem[];
}

export interface CaseTimelineItem {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description?: string | undefined;
  actorType?: string | undefined;
  fromStatus?: BookingCaseStatus | undefined;
  toStatus?: BookingCaseStatus | undefined;
}

export interface NotificationDto {
  id: string;
  userId?: string | null | undefined;
  bookingCaseId?: string | null | undefined;
  type: string;
  title: string;
  message: string;
  readAt?: string | null | undefined;
  createdAt: string;
}

export interface OperationsCaseApplicant {
  id: string;
  applicantId: string;
  position: number;
  relation: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  passportMasked: string;
  passportExpiry: string;
}

export interface OperationsCaseDetail {
  id: string;
  caseNumber: string;
  status: BookingCaseStatus;
  bookingMode: string;
  preferredDateFrom?: string | null | undefined;
  preferredDateTo?: string | null | undefined;
  preferredTime?: string | null | undefined;
  allowGroupSplit: boolean;
  provider: {
    code: ProviderCode;
    name: string;
    sourceCountry: string;
    destinationCountry: string;
    applicationCentre: string;
    visaCategory: string;
    visaSubcategory: string;
  };
  providerAccount?: {
    id: string;
    label?: string | null | undefined;
    username?: string | null | undefined;
  } | null | undefined;
  client?: {
    id: string;
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
  } | null | undefined;
  applicants: OperationsCaseApplicant[];
  automationSession?: {
    id: string;
    status: string;
    humanActionType?: string | null | undefined;
    resumeToStatus?: BookingCaseStatus | null | undefined;
    currentPath?: string | null | undefined;
    expiresAt?: string | null | undefined;
  } | null | undefined;
  appointment?: {
    confirmationCode?: string | null | undefined;
    appointmentDate?: string | null | undefined;
    appointmentTime?: string | null | undefined;
    centre?: string | null | undefined;
  } | null | undefined;
  paymentHandoff?: {
    id: string;
    amount?: number | null | undefined;
    currency?: string | null | undefined;
    safePaymentPath?: string | null | undefined;
    status: string;
    deadlineAt?: string | null | undefined;
  } | null | undefined;
  createdAt: string;
  updatedAt: string;
}



