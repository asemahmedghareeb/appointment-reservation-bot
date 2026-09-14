import { encrypt, decrypt } from '@visaflow/crypto';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { BookingCaseStatus } from '@visaflow/database';

export class AutomationSessionService {
  constructor(
    private readonly repo: WorkerRepository,
    private readonly workerId: string,
  ) {}

  async createSession(params: {
    bookingCaseId: string;
    providerAccountId?: string | null | undefined;
    providerCode: any;
    storageStateJson?: string | undefined;
    expiresInMinutes?: number | undefined;
  }) {
    let storageStateEncrypted: string | undefined;
    if (params.storageStateJson) {
      storageStateEncrypted = encrypt(params.storageStateJson);
    }

    const expiresAt = params.expiresInMinutes
      ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 30 * 60 * 1000);

    return this.repo.createAutomationSession({
      bookingCaseId: params.bookingCaseId,
      providerAccountId: params.providerAccountId,
      providerCode: params.providerCode,
      workerId: this.workerId,
      status: 'ACTIVE',
      storageStateEncrypted,
      expiresAt,
    });
  }

  async recordHumanVerificationCheckpoint(params: {
    sessionId: string;
    humanActionType: string;
    resumeToStatus: BookingCaseStatus;
    checkpoint?: Record<string, unknown> | undefined;
    storageStateJson?: string | undefined;
    currentPath?: string | undefined;
  }) {
    let storageStateEncrypted: string | undefined;
    if (params.storageStateJson) {
      storageStateEncrypted = encrypt(params.storageStateJson);
    }

    return this.repo.updateAutomationSession(params.sessionId, {
      status: 'HUMAN_ACTION_REQUIRED',
      humanActionType: params.humanActionType,
      resumeToStatus: params.resumeToStatus,
      checkpointJson: params.checkpoint,
      currentPath: params.currentPath,
      ...(storageStateEncrypted ? { storageStateEncrypted } : {}),
      lastHeartbeatAt: new Date(),
    });
  }

  async recordPaymentHandoff(params: {
    sessionId: string;
    currentPath?: string | undefined;
    storageStateJson?: string | undefined;
  }) {
    let storageStateEncrypted: string | undefined;
    if (params.storageStateJson) {
      storageStateEncrypted = encrypt(params.storageStateJson);
    }

    return this.repo.updateAutomationSession(params.sessionId, {
      status: 'PAYMENT_HANDOFF',
      currentPath: params.currentPath,
      ...(storageStateEncrypted ? { storageStateEncrypted } : {}),
      lastHeartbeatAt: new Date(),
    });
  }


  async completeSession(sessionId: string) {
    return this.repo.updateAutomationSession(sessionId, {
      status: 'COMPLETED',
      lastHeartbeatAt: new Date(),
    });
  }

  async failSession(sessionId: string) {
    return this.repo.updateAutomationSession(sessionId, {
      status: 'FAILED',
      lastHeartbeatAt: new Date(),
    });
  }

  async getDecryptedStorageState(sessionId: string): Promise<string | undefined> {
    const session = await this.repo.findActiveSessionByCaseId(sessionId);
    if (!session || !session.storageStateEncrypted) {
      return undefined;
    }

    try {
      return decrypt(session.storageStateEncrypted);
    } catch {
      return undefined;
    }
  }

  assertSessionOwnership(sessionWorkerId: string): boolean {
    return sessionWorkerId === this.workerId;
  }
}
