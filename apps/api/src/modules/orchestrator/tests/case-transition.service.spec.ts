import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingCaseStatus, StateActorType } from '@visaflow/database';
import { CaseTransitionService } from '../services/case-transition.service.js';
import { OrchestratorRepository } from '../repositories/orchestrator.repository.js';
import { StaleCaseStateError } from '../errors/stale-case-state.error.js';
import { HumanResumeTargetMismatchError } from '../errors/human-resume-target-mismatch.error.js';
import { IllegalTransitionError } from '@visaflow/provider-core';

describe('CaseTransitionService', () => {
  let service: CaseTransitionService;
  let repo: Partial<OrchestratorRepository>;

  const mockCase = {
    id: 'case_1',
    status: BookingCaseStatus.READY,
  };

  beforeEach(() => {
    repo = {
      findCaseById: vi.fn().mockResolvedValue(mockCase),
      atomicStatusTransition: vi.fn().mockImplementation((params) => ({
        ...mockCase,
        status: params.toStatus,
      })),
      getLatestStateHistory: vi.fn().mockResolvedValue(null),
    };

    service = new CaseTransitionService(repo as OrchestratorRepository);
  });

  it('atomically transitions case state with history and activity log', async () => {
    const updated = await service.transition({
      caseId: 'case_1',
      toStatus: BookingCaseStatus.AUTHENTICATING,
      expectedFromStatus: BookingCaseStatus.READY,
      reason: 'Start auth',
    });

    expect(repo.atomicStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case_1',
        fromStatus: BookingCaseStatus.READY,
        toStatus: BookingCaseStatus.AUTHENTICATING,
        actorType: StateActorType.SYSTEM,
        reason: 'Start auth',
      }),
    );
    expect(updated.status).toBe(BookingCaseStatus.AUTHENTICATING);
  });

  it('rejects illegal transition according to state machine', async () => {
    await expect(
      service.transition({
        caseId: 'case_1',
        toStatus: BookingCaseStatus.CONFIRMED, // READY -> CONFIRMED is illegal
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });

  it('detects stale state when expectedFromStatus does not match loaded status', async () => {
    await expect(
      service.transition({
        caseId: 'case_1',
        toStatus: BookingCaseStatus.AUTHENTICATING,
        expectedFromStatus: BookingCaseStatus.MONITORING, // Actual is READY
      }),
    ).rejects.toThrow(StaleCaseStateError);
  });

  it('validates human resume target matches recorded resumeToStatus', async () => {
    // Case currently in HUMAN_VERIFICATION_REQUIRED
    vi.spyOn(repo as any, 'findCaseById').mockResolvedValue({
      id: 'case_1',
      status: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
    } as any);

    // Stored checkpoint was MONITORING
    vi.spyOn(repo as any, 'getLatestStateHistory').mockResolvedValue({
      id: 'hist_1',
      bookingCaseId: 'case_1',
      fromStatus: BookingCaseStatus.MONITORING,
      toStatus: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
      actorType: StateActorType.SYSTEM,
      actorId: null,
      reason: null,
      metadata: {
        resumeToStatus: BookingCaseStatus.MONITORING,
        humanActionType: 'CAPTCHA',
      },
      createdAt: new Date(),
    });

    // Valid resume to MONITORING succeeds
    await expect(
      service.transition({
        caseId: 'case_1',
        toStatus: BookingCaseStatus.MONITORING,
      }),
    ).resolves.toBeDefined();

    // Invalid resume to PAYMENT_PROCESSING throws HumanResumeTargetMismatchError
    await expect(
      service.transition({
        caseId: 'case_1',
        toStatus: BookingCaseStatus.PAYMENT_PROCESSING,
      }),
    ).rejects.toThrow(HumanResumeTargetMismatchError);
  });
});
