import { describe, it, expect, beforeEach } from 'vitest';
import { OperationsEventsService } from '../operations-events.service';
import { OperationsEventType } from '@visaflow/shared-types';
import { take } from 'rxjs';

describe('OperationsEventsService', () => {
  let service: OperationsEventsService;

  beforeEach(() => {
    service = new OperationsEventsService();
  });

  it('should publish and receive operations events via stream', (done) => {
    const stream$ = service.getEventStream();

    stream$.pipe(take(1)).subscribe({
      next: (msg) => {
        expect(msg.data).toBeDefined();
        const parsed = JSON.parse(msg.data as string);
        expect(parsed.type).toBe(OperationsEventType.CASE_STATUS_CHANGED);
        expect(parsed.caseId).toBe('test-case-1');
        expect(parsed.data.newStatus).toBe('MONITORING');
      },
      complete: () => {
        // completed successfully
      },
    });

    service.emit(OperationsEventType.CASE_STATUS_CHANGED, 'test-case-1', {
      newStatus: 'MONITORING',
    });
  });
});
