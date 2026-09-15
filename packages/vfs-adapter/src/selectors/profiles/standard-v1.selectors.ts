import { LOGIN_SELECTORS } from '../common/login.selectors.js';
import { BOOKING_SELECTORS } from '../common/booking.selectors.js';
import { APPLICANT_SELECTORS } from '../common/applicant.selectors.js';

export const STANDARD_V1_SELECTORS = {
  login: LOGIN_SELECTORS,
  bookingHome: BOOKING_SELECTORS.bookingHome,
  appointmentDetails: BOOKING_SELECTORS.appointmentDetails,
  applicantDetails: APPLICANT_SELECTORS.applicantDetails,
  payment: BOOKING_SELECTORS.payment,
  confirmation: BOOKING_SELECTORS.confirmation,
  humanVerification: BOOKING_SELECTORS.humanVerification,
  slotSelection: {
    heading: 'Select Slot',
    slotItem: '.slot-item, [data-testid="slot-candidate"], input[type="radio"][name="slot"]',
    continueButton: 'button:has-text("Continue"), button:has-text("Proceed to Payment")',
  },
  availability: {
    heading: 'Appointment Availability',
    slotNotice: '.slot-notice, .availability-message, [data-testid="availability-notice"]',
    earliestSlotBadge: '.earliest-slot, [data-testid="earliest-slot"]',
    noSlotNotice: '.no-slot-notice',
  },
} as const;
