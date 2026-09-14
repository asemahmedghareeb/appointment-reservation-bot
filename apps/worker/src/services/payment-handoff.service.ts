import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { PaymentHandoffStatus } from '@visaflow/database';

export class PaymentHandoffService {
  constructor(private readonly repo: WorkerRepository) {}

  async createHandoff(params: {
    bookingCaseId: string;
    automationSessionId?: string | null | undefined;
    status?: PaymentHandoffStatus | undefined;
    amount?: number | null | undefined;
    currency?: string | null | undefined;
    externalReference?: string | null | undefined;
    deadlineAt?: Date | null | undefined;
    safePaymentPath?: string | null | undefined;
  }) {
    return this.repo.createPaymentHandoff({
      bookingCaseId: params.bookingCaseId,
      automationSessionId: params.automationSessionId,
      status: params.status ?? 'REQUIRED',
      amount: params.amount,
      currency: params.currency,
      externalReference: params.externalReference,
      deadlineAt: params.deadlineAt,
      safePaymentPath: params.safePaymentPath,
    });
  }

}
