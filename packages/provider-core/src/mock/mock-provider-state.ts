import type { MockScenario } from './mock-scenario.js';

export interface CaseMockState {
  caseId: string;
  scenario: MockScenario;
  authenticated: boolean;
  humanActionCompleted: boolean;
  slotSelected?: boolean;
  bookingStarted?: boolean;
  applicantsSubmitted?: boolean;
  paymentInitiated?: boolean;
}
