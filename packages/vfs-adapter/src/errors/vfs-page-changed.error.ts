export class VfsPageChangedError extends Error {
  constructor(
    public readonly expectedPage: string,
    public readonly actualPage: string,
    public readonly currentPath?: string,
  ) {
    super(`VFS page changed unexpectedly. Expected "${expectedPage}" but detected "${actualPage}"${currentPath ? ` at ${currentPath}` : ''}.`);
    this.name = 'VfsPageChangedError';
  }
}
