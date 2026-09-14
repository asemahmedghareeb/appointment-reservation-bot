import { describe, it, expect } from 'vitest';
import { BookingCaseStatus } from '@visaflow/shared-types';
import {
  BookingCaseStateMachine,
  defaultStateMachine,
  CANONICAL_TRANSITION_MATRIX,
  TERMINAL_STATUSES,
  ALLOWED_HUMAN_RESUME_TARGETS,
  IllegalTransitionError,
} from '../src/index.js';

describe('BookingCaseStateMachine', () => {
  const sm = new BookingCaseStateMachine();
  const allStatuses = Object.values(BookingCaseStatus);

  it('preserves exactly 17 canonical statuses', () => {
    expect(allStatuses.length).toBe(17);
    expect(Object.keys(CANONICAL_TRANSITION_MATRIX).length).toBe(17);
  });

  describe('Canonical Transition Matrix Edges', () => {
    for (const [from, allowedTos] of Object.entries(CANONICAL_TRANSITION_MATRIX)) {
      const fromStatus = from as BookingCaseStatus;
      for (const toStatus of allowedTos) {
        it(`allows transition: ${fromStatus} -> ${toStatus}`, () => {
          expect(sm.canTransition(fromStatus, toStatus)).toBe(true);
          expect(() => sm.assertTransition(fromStatus, toStatus)).not.toThrow();
        });
      }
    }
  });

  describe('Exhaustive 17x17 Matrix Check', () => {
    it('verifies that every non-canonical pair is rejected with IllegalTransitionError', () => {
      let allowedCount = 0;
      let rejectedCount = 0;

      for (const from of allStatuses) {
        const allowedTos = CANONICAL_TRANSITION_MATRIX[from] || [];
        for (const to of allStatuses) {
          if (allowedTos.includes(to)) {
            allowedCount++;
            expect(sm.canTransition(from, to)).toBe(true);
          } else {
            rejectedCount++;
            expect(sm.canTransition(from, to)).toBe(false);
            expect(() => sm.assertTransition(from, to)).toThrow(IllegalTransitionError);
          }
        }
      }

      expect(allowedCount + rejectedCount).toBe(17 * 17);
      expect(allowedCount).toBeGreaterThan(0);
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe('Terminal Statuses', () => {
    for (const terminal of TERMINAL_STATUSES) {
      it(`enforces terminal status '${terminal}' has 0 outbound transitions`, () => {
        expect(sm.isTerminal(terminal)).toBe(true);
        expect(sm.getAllowedTransitions(terminal)).toHaveLength(0);

        for (const target of allStatuses) {
          expect(sm.canTransition(terminal, target)).toBe(false);
          expect(() => sm.assertTransition(terminal, target)).toThrow(IllegalTransitionError);
        }
      });
    }
  });

  describe('Mandatory Rejected Transitions (Section 16)', () => {
    const forbiddenPairs: [BookingCaseStatus, BookingCaseStatus][] = [
      [BookingCaseStatus.DRAFT, BookingCaseStatus.CONFIRMED],
      [BookingCaseStatus.READY, BookingCaseStatus.CONFIRMED],
      [BookingCaseStatus.MONITORING, BookingCaseStatus.CONFIRMED],
      [BookingCaseStatus.MONITORING, BookingCaseStatus.PAYMENT_REQUIRED],
      [BookingCaseStatus.SLOT_FOUND, BookingCaseStatus.CONFIRMED],
      [BookingCaseStatus.PAYMENT_REQUIRED, BookingCaseStatus.CONFIRMED],
      [BookingCaseStatus.CONFIRMED, BookingCaseStatus.MONITORING],
      [BookingCaseStatus.FAILED, BookingCaseStatus.READY],
    ];

    for (const [from, to] of forbiddenPairs) {
      it(`strictly rejects ${from} -> ${to}`, () => {
        expect(sm.canTransition(from, to)).toBe(false);
        expect(() => sm.assertTransition(from, to)).toThrow(IllegalTransitionError);
      });
    }
  });

  describe('Human Verification Resume Targets', () => {
    it('verifies all expected candidate resume states are allowed from HUMAN_VERIFICATION_REQUIRED', () => {
      for (const target of ALLOWED_HUMAN_RESUME_TARGETS) {
        expect(sm.canTransition(BookingCaseStatus.HUMAN_VERIFICATION_REQUIRED, target)).toBe(true);
        expect(sm.isAllowedHumanResumeTarget(target)).toBe(true);
      }
    });

    it('verifies terminal states cannot be human resume targets', () => {
      for (const terminal of TERMINAL_STATUSES) {
        expect(sm.isAllowedHumanResumeTarget(terminal)).toBe(false);
      }
    });
  });

  it('defaultStateMachine singleton matches new instance', () => {
    expect(defaultStateMachine.canTransition(BookingCaseStatus.DRAFT, BookingCaseStatus.READY)).toBe(true);
  });
});
