export class VfsSessionError extends Error {
  constructor(
    public readonly reason: string,
    public readonly caseId?: string,
  ) {
    super(`VFS session error${caseId ? ` for case ${caseId}` : ''}: ${reason}`);
    this.name = 'VfsSessionError';
  }
}
