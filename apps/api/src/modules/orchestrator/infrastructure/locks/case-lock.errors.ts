export class CaseLockConflictError extends Error {
  constructor(public readonly caseId: string, message?: string) {
    super(
      message ??
        `Cannot acquire lock for case '${caseId}': already locked by another process.`,
    );
    this.name = 'CaseLockConflictError';
  }
}

export class CaseLockOwnershipLostError extends Error {
  constructor(public readonly caseId: string, message?: string) {
    super(
      message ??
        `Lock ownership lost for case '${caseId}'. Lock was modified or expired.`,
    );
    this.name = 'CaseLockOwnershipLostError';
  }
}
