export enum ErrorClassification {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  HUMAN_ACTION_REQUIRED = 'HUMAN_ACTION_REQUIRED',
  REMOTE_STATE_UNKNOWN = 'REMOTE_STATE_UNKNOWN',
  CONFIGURATION = 'CONFIGURATION',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
}

export interface ClassifiedErrorDetails {
  classification: ErrorClassification;
  message: string;
  isRetryable: boolean;
  requiresInspection: boolean;
  rawError?: unknown;
}
