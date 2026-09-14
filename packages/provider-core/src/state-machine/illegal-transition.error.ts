import type { BookingCaseStatus } from '@visaflow/shared-types';

export class IllegalTransitionError extends Error {
  constructor(
    public readonly fromStatus: BookingCaseStatus,
    public readonly toStatus: BookingCaseStatus,
    message?: string,
  ) {
    super(
      message ??
        `Illegal status transition requested from '${fromStatus}' to '${toStatus}'.`,
    );
    this.name = 'IllegalTransitionError';
  }
}
