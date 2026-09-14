export interface CaseLockConfig {
  ttlMs: number;
  heartbeatIntervalMs: number;
  keyPrefix?: string;
}

export const DEFAULT_CASE_LOCK_CONFIG: CaseLockConfig = Object.freeze({
  ttlMs: 30_000,
  heartbeatIntervalMs: 10_000,
});
