export interface CaseLockHandle {
  caseId: string;
  key: string;
  ownerId: string;
  sessionId: string;
  token: string;
  ttlMs: number;
}

export interface AcquireLockParams {
  caseId: string;
  ownerId: string;
  sessionId: string;
  ttlMs?: number;
}
