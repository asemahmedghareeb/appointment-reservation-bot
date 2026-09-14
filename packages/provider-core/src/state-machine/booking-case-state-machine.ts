import type { BookingCaseStatus } from '@visaflow/shared-types';
import {
  CANONICAL_TRANSITION_MATRIX,
  TERMINAL_STATUSES,
  ALLOWED_HUMAN_RESUME_TARGETS,
} from './transition-matrix.js';
import { IllegalTransitionError } from './illegal-transition.error.js';

export class BookingCaseStateMachine {
  canTransition(from: BookingCaseStatus, to: BookingCaseStatus): boolean {
    const allowed = CANONICAL_TRANSITION_MATRIX[from];
    if (!allowed) {
      return false;
    }
    return allowed.includes(to);
  }

  assertTransition(from: BookingCaseStatus, to: BookingCaseStatus): void {
    if (!this.canTransition(from, to)) {
      throw new IllegalTransitionError(
        from,
        to,
        `Transition from '${from}' to '${to}' is not permitted by canonical state machine.`,
      );
    }
  }

  getAllowedTransitions(from: BookingCaseStatus): readonly BookingCaseStatus[] {
    return CANONICAL_TRANSITION_MATRIX[from] ?? [];
  }

  isTerminal(status: BookingCaseStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }

  isAllowedHumanResumeTarget(status: BookingCaseStatus): boolean {
    return ALLOWED_HUMAN_RESUME_TARGETS.includes(status);
  }
}

export const defaultStateMachine = new BookingCaseStateMachine();
