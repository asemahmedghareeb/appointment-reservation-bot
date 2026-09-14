import type { ProviderContext } from '../context/provider-context.js';
import type { AuthenticateResult } from '../types/authenticate-result.js';
import type { RouteInspectionResult } from '../types/route-inspection-result.js';
import type { AvailabilityResult } from '../types/availability-result.js';
import type { BookingResult } from '../types/booking-result.js';
import type { ProviderApplicantInput } from '../types/provider-applicant-input.js';
import type { ApplicantSubmissionResult } from '../types/applicant-submission-result.js';
import type { SlotCandidate } from '../types/slot-candidate.js';
import type { AppointmentSelectionResult } from '../types/appointment-selection-result.js';
import type { PaymentStateResult } from '../types/payment-state-result.js';
import type { ConfirmationResult } from '../types/confirmation-result.js';
import type { ResumeResult } from '../types/resume-result.js';

export interface VisaProviderAdapter {
  readonly adapterId: string;

  authenticate(context: ProviderContext): Promise<AuthenticateResult>;

  inspectRoute(context: ProviderContext): Promise<RouteInspectionResult>;

  checkAvailability(context: ProviderContext): Promise<AvailabilityResult>;

  beginBooking(context: ProviderContext, slot: SlotCandidate): Promise<BookingResult>;

  addApplicants(
    context: ProviderContext,
    applicants: ProviderApplicantInput[],
  ): Promise<ApplicantSubmissionResult>;

  selectAppointment(
    context: ProviderContext,
    slot: SlotCandidate,
  ): Promise<AppointmentSelectionResult>;

  getPaymentState(context: ProviderContext): Promise<PaymentStateResult>;

  getConfirmation(context: ProviderContext): Promise<ConfirmationResult>;

  resume(context: ProviderContext): Promise<ResumeResult>;
}
