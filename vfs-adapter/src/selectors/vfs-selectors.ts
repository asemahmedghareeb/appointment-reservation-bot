import { LOGIN_SELECTORS } from './common/login.selectors.js';
import { BOOKING_SELECTORS } from './common/booking.selectors.js';
import { APPLICANT_SELECTORS } from './common/applicant.selectors.js';
import { STANDARD_V1_SELECTORS } from './profiles/standard-v1.selectors.js';
import { CALENDAR_V1_SELECTORS } from './profiles/calendar-v1.selectors.js';
import { EARLIEST_SLOT_V1_SELECTORS } from './profiles/earliest-slot-v1.selectors.js';

export const VFS_SELECTORS = {
  login: LOGIN_SELECTORS,
  bookingHome: BOOKING_SELECTORS.bookingHome,
  appointmentDetails: BOOKING_SELECTORS.appointmentDetails,
  availability: STANDARD_V1_SELECTORS.availability,
  applicantDetails: APPLICANT_SELECTORS.applicantDetails,
  slotSelection: STANDARD_V1_SELECTORS.slotSelection,
  payment: BOOKING_SELECTORS.payment,
  confirmation: BOOKING_SELECTORS.confirmation,
  humanVerification: BOOKING_SELECTORS.humanVerification,
} as const;

export {
  LOGIN_SELECTORS,
  BOOKING_SELECTORS,
  APPLICANT_SELECTORS,
  STANDARD_V1_SELECTORS,
  CALENDAR_V1_SELECTORS,
  EARLIEST_SLOT_V1_SELECTORS,
};
