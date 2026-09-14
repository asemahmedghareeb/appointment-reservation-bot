import { Injectable } from '@nestjs/common';
import { BookingCaseStatus } from '@visaflow/database';
import type { IdempotencyOutcome } from '@visaflow/shared-types';
import { OrchestratorRepository } from '../repositories/orchestrator.repository.js';
import { BookingCaseNotFoundError } from '../../booking-cases/errors/booking-case-not-found.error.js';

@Injectable()
export class IdempotencyGuardService {
  constructor(private readonly repo: OrchestratorRepository) {}

  async evaluateAvailabilityCheck(caseId: string): Promise<IdempotencyOutcome> {
    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(caseId);
    }

    const current = bookingCase.status;

    // Compatible execution states
    if (current === BookingCaseStatus.MONITORING || current === BookingCaseStatus.WAITING_QUEUE) {
      return { outcome: 'EXECUTE' };
    }

    // Advanced progress states
    const advancedStatuses: BookingCaseStatus[] = [
      BookingCaseStatus.SLOT_FOUND,
      BookingCaseStatus.BOOKING,
      BookingCaseStatus.ADDING_APPLICANTS,
      BookingCaseStatus.APPOINTMENT_SELECTED,
      BookingCaseStatus.PAYMENT_REQUIRED,
      BookingCaseStatus.PAYMENT_PROCESSING,
      BookingCaseStatus.CONFIRMED,
    ];

    if (advancedStatuses.includes(current)) {
      return {
        outcome: 'SKIPPED_ALREADY_APPLIED',
        currentStatus: current as any,
      };
    }

    return {
      outcome: 'SKIPPED_STALE',
      currentStatus: current as any,
    };
  }

  async evaluateBookingExecution(caseId: string): Promise<IdempotencyOutcome> {
    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(caseId);
    }

    const current = bookingCase.status;

    if (current === BookingCaseStatus.SLOT_FOUND) {
      return { outcome: 'EXECUTE' };
    }

    const downstreamBookingStatuses: BookingCaseStatus[] = [
      BookingCaseStatus.BOOKING,
      BookingCaseStatus.ADDING_APPLICANTS,
      BookingCaseStatus.APPOINTMENT_SELECTED,
      BookingCaseStatus.PAYMENT_REQUIRED,
      BookingCaseStatus.PAYMENT_PROCESSING,
      BookingCaseStatus.CONFIRMED,
    ];

    if (downstreamBookingStatuses.includes(current)) {
      return {
        outcome: 'SKIPPED_ALREADY_APPLIED',
        currentStatus: current as any,
      };
    }

    return {
      outcome: 'SKIPPED_STALE',
      currentStatus: current as any,
    };
  }

  async evaluateSessionResume(caseId: string): Promise<IdempotencyOutcome> {
    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(caseId);
    }

    const current = bookingCase.status;

    if (current === BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED) {
      return { outcome: 'EXECUTE' };
    }

    return {
      outcome: 'SKIPPED_ALREADY_APPLIED',
      currentStatus: current as any,
    };
  }
}
