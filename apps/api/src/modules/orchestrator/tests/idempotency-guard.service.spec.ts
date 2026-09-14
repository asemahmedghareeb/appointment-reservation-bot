import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingCaseStatus } from '@visaflow/database';
import { IdempotencyGuardService } from '../services/idempotency-guard.service.js';
import { OrchestratorRepository } from '../repositories/orchestrator.repository.js';

describe('IdempotencyGuardService', () => {
  let guard: IdempotencyGuardService;
  let repo: any;

  beforeEach(() => {
    repo = {
      findCaseById: vi.fn(),
    };
    guard = new IdempotencyGuardService(repo as OrchestratorRepository);
  });

  describe('evaluateAvailabilityCheck', () => {
    it('allows execution when case is MONITORING', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.MONITORING,
      } as any);

      const res = await guard.evaluateAvailabilityCheck('c1');
      expect(res.outcome).toBe('EXECUTE');
    });

    it('allows execution when case is WAITING_QUEUE', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.WAITING_QUEUE,
      } as any);

      const res = await guard.evaluateAvailabilityCheck('c1');
      expect(res.outcome).toBe('EXECUTE');
    });

    it('returns SKIPPED_ALREADY_APPLIED when case has already found slot', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.SLOT_FOUND,
      } as any);

      const res = await guard.evaluateAvailabilityCheck('c1');
      expect(res.outcome).toBe('SKIPPED_ALREADY_APPLIED');
      if (res.outcome === 'SKIPPED_ALREADY_APPLIED') {
        expect(res.currentStatus).toBe(BookingCaseStatus.SLOT_FOUND);
      }
    });

    it('returns SKIPPED_STALE when case is CANCELLED', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.CANCELLED,
      } as any);

      const res = await guard.evaluateAvailabilityCheck('c1');
      expect(res.outcome).toBe('SKIPPED_STALE');
    });
  });

  describe('evaluateBookingExecution', () => {
    it('allows execution when case is SLOT_FOUND', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.SLOT_FOUND,
      } as any);

      const res = await guard.evaluateBookingExecution('c1');
      expect(res.outcome).toBe('EXECUTE');
    });

    it('returns SKIPPED_ALREADY_APPLIED when booking has already progressed to BOOKING or beyond', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.BOOKING,
      } as any);

      const res = await guard.evaluateBookingExecution('c1');
      expect(res.outcome).toBe('SKIPPED_ALREADY_APPLIED');
    });
  });

  describe('evaluateSessionResume', () => {
    it('allows execution when case is in HUMAN_VERIFICATION_REQUIRED', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED,
      } as any);

      const res = await guard.evaluateSessionResume('c1');
      expect(res.outcome).toBe('EXECUTE');
    });

    it('returns SKIPPED_ALREADY_APPLIED when case has already resumed', async () => {
      vi.spyOn(repo, 'findCaseById').mockResolvedValue({
        id: 'c1',
        status: BookingCaseStatus.MONITORING,
      } as any);

      const res = await guard.evaluateSessionResume('c1');
      expect(res.outcome).toBe('SKIPPED_ALREADY_APPLIED');
    });
  });
});
