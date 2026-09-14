export interface QueueHealthMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface WorkerHeartbeatPayload {
  workerId: string;
  startedAt: string;
  lastHeartbeatAt: string;
  activeJobs: number;
  activeBrowserSessions: number;
}

export interface OperationalMetricsSnapshot {
  timestamp: string;
  queues: QueueHealthMetrics[];
  activeSessions: number;
  activeLocks: number;
  lockConflicts: number;
  slotFoundCount: number;
  slotLostCount: number;
  bookingSuccessCount: number;
  confirmedCount: number;
  humanVerificationCount: number;
  providerPageChangedCount: number;
}
