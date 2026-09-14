import { BookingCaseStatus } from '@visaflow/shared-types';

export const TERMINAL_STATUSES: readonly BookingCaseStatus[] = Object.freeze([
  BookingCaseStatus.CONFIRMED,
  BookingCaseStatus.EXPIRED,
  BookingCaseStatus.FAILED,
  BookingCaseStatus.CANCELLED,
]);

export const ALLOWED_HUMAN_RESUME_TARGETS: readonly BookingCaseStatus[] = Object.freeze([
  BookingCaseStatus.AUTHENTICATING,
  BookingCaseStatus.MONITORING,
  BookingCaseStatus.WAITING_QUEUE,
  BookingCaseStatus.BOOKING,
  BookingCaseStatus.ADDING_APPLICANTS,
  BookingCaseStatus.APPOINTMENT_SELECTED,
  BookingCaseStatus.PAYMENT_REQUIRED,
  BookingCaseStatus.PAYMENT_PROCESSING,
]);

export const CANONICAL_TRANSITION_MATRIX: Readonly<
  Record<BookingCaseStatus, readonly BookingCaseStatus[]>
> = Object.freeze({
  [BookingCaseStatus.DRAFT]: Object.freeze([
    BookingCaseStatus.READY,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.READY]: Object.freeze([
    BookingCaseStatus.AUTHENTICATING,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.AUTHENTICATING]: Object.freeze([
    BookingCaseStatus.MONITORING,
    BookingCaseStatus.WAITING_QUEUE,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.MONITORING]: Object.freeze([
    BookingCaseStatus.SLOT_FOUND,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.WAITING_QUEUE]: Object.freeze([
    BookingCaseStatus.SLOT_FOUND,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.EXPIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.SLOT_FOUND]: Object.freeze([
    BookingCaseStatus.BOOKING,
    BookingCaseStatus.SLOT_LOST,
    BookingCaseStatus.EXPIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.BOOKING]: Object.freeze([
    BookingCaseStatus.ADDING_APPLICANTS,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.SLOT_LOST,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.ADDING_APPLICANTS]: Object.freeze([
    BookingCaseStatus.APPOINTMENT_SELECTED,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.SLOT_LOST,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.APPOINTMENT_SELECTED]: Object.freeze([
    BookingCaseStatus.PAYMENT_REQUIRED,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.EXPIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.PAYMENT_REQUIRED]: Object.freeze([
    BookingCaseStatus.PAYMENT_PROCESSING,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.EXPIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.PAYMENT_PROCESSING]: Object.freeze([
    BookingCaseStatus.CONFIRMED,
    BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    BookingCaseStatus.EXPIRED,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.SLOT_LOST]: Object.freeze([
    BookingCaseStatus.MONITORING,
    BookingCaseStatus.WAITING_QUEUE,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  [BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED]: Object.freeze([
    ...ALLOWED_HUMAN_RESUME_TARGETS,
    BookingCaseStatus.FAILED,
    BookingCaseStatus.CANCELLED,
  ]),

  // Terminal states (0 outbound transitions)
  [BookingCaseStatus.CONFIRMED]: Object.freeze([]),
  [BookingCaseStatus.EXPIRED]: Object.freeze([]),
  [BookingCaseStatus.FAILED]: Object.freeze([]),
  [BookingCaseStatus.CANCELLED]: Object.freeze([]),
});
