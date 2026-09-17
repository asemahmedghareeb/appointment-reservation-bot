export class VfsRouteNotSupportedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly routeInfo?: Record<string, unknown>,
  ) {
    super(`VFS route configuration is not supported: ${reason}`);
    this.name = 'VfsRouteNotSupportedError';
  }
}
