import type { BookingCaseStatus } from '../enums/booking-case-status.enum.js';
import type { OrchestratorJobType } from './orchestrator-job-type.enum.js';

export interface OrchestratorJobEnvelope<TPayload = unknown> {
  version: 1;
  jobType: OrchestratorJobType;
  caseId: string;
  correlationId: string;
  cycleId: string;
  idempotencyKey: string;
  expectedStatuses: BookingCaseStatus[];
  createdAt: string;
  payload: TPayload;
}
