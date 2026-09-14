import { Injectable } from '@nestjs/common';
import {
  BookingCaseStatus,
  StateActorType,
  type BookingCase,
} from '@visaflow/database';
import {
  BookingCaseStateMachine,
  defaultStateMachine,
} from '@visaflow/provider-core';
import { OrchestratorRepository } from '../repositories/orchestrator.repository.js';
import { BookingCaseNotFoundError } from '../../booking-cases/errors/booking-case-not-found.error.js';
import { StaleCaseStateError } from '../errors/stale-case-state.error.js';
import { HumanResumeTargetMismatchError } from '../errors/human-resume-target-mismatch.error.js';

export interface TransitionRequest {
  caseId: string;
  toStatus: BookingCaseStatus;
  actorType?: StateActorType;
  actorId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
  expectedFromStatus?: BookingCaseStatus;
}

@Injectable()
export class CaseTransitionService {
  private readonly stateMachine: BookingCaseStateMachine;

  constructor(
    private readonly orchestratorRepo: OrchestratorRepository,
    stateMachineOverride?: BookingCaseStateMachine,
  ) {
    this.stateMachine = stateMachineOverride ?? defaultStateMachine;
  }

  async transition(request: TransitionRequest): Promise<BookingCase> {
    const bookingCase = await this.orchestratorRepo.findCaseById(request.caseId);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(request.caseId);
    }

    const currentStatus = bookingCase.status;

    // 1. Verify expected status matches loaded case status
    if (request.expectedFromStatus && request.expectedFromStatus !== currentStatus) {
      throw new StaleCaseStateError(
        request.caseId,
        request.expectedFromStatus,
        currentStatus,
      );
    }

    // 2. Pure state machine invariant check
    this.stateMachine.assertTransition(
      currentStatus as unknown as any,
      request.toStatus as unknown as any,
    );

    // 3. Human verification resume validation
    if (
      currentStatus === BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED &&
      request.toStatus !== BookingCaseStatus.FAILED &&
      request.toStatus !== BookingCaseStatus.CANCELLED
    ) {
      const latestHistory = await this.orchestratorRepo.getLatestStateHistory(request.caseId);
      const historyMeta = (latestHistory?.metadata as Record<string, unknown>) || {};
      const expectedResumeStatus = historyMeta.resumeToStatus as BookingCaseStatus | undefined;

      if (expectedResumeStatus && request.toStatus !== expectedResumeStatus) {
        throw new HumanResumeTargetMismatchError(
          request.caseId,
          expectedResumeStatus as any,
          request.toStatus as any,
        );
      }
    }

    // 4. Atomic conditional transition with history and activity log
    const updated = await this.orchestratorRepo.atomicStatusTransition({
      caseId: request.caseId,
      fromStatus: currentStatus,
      toStatus: request.toStatus,
      actorType: request.actorType ?? StateActorType.SYSTEM,
      actorId: request.actorId,
      reason: request.reason,
      metadata: request.metadata,
    });

    return updated;
  }
}
