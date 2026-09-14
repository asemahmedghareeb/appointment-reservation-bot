export interface SlotCandidate {
  externalSlotId?: string;
  date: string;
  time?: string;
  centre?: string;
  capacity?: number;
  metadata?: Record<string, unknown>;
}
