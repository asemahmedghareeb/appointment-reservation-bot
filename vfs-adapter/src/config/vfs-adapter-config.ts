export interface VfsAdapterConfig {
  headless: boolean;
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  allowedOrigins: string[];
  sessionTtlMinutes: number;
  useCdp?: boolean | undefined;
  cdpPort?: number | undefined;
  cdpUrl?: string | undefined;
  chromePath?: string | undefined;
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
}

export const DEFAULT_VFS_CONFIG: VfsAdapterConfig = {
  headless: true,
  navigationTimeoutMs: 30000,
  actionTimeoutMs: 15000,
  allowedOrigins: ['https://visa.vfsglobal.com'],
  sessionTtlMinutes: 30,
  useCdp: true,
  cdpPort: 9222,
};

export function createVfsConfig(overrides?: Partial<VfsAdapterConfig>): VfsAdapterConfig {
  return {
    ...DEFAULT_VFS_CONFIG,
    ...overrides,
    allowedOrigins: overrides?.allowedOrigins ?? DEFAULT_VFS_CONFIG.allowedOrigins,
    useCdp: overrides?.useCdp ?? (process.env.VFS_USE_CDP !== 'false'),
    cdpPort: overrides?.cdpPort ?? (Number(process.env.VFS_CDP_PORT) || 9222),
  };
}
