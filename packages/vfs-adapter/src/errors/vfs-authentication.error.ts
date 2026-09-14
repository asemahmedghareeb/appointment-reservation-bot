export class VfsAuthenticationError extends Error {
  constructor(
    public readonly reason: string,
    public readonly isRetryable: boolean = false,
  ) {
    super(`VFS authentication failed: ${reason}`);
    this.name = 'VfsAuthenticationError';
  }
}
