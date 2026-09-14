import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { Subject, Observable, interval, map, merge } from 'rxjs';
import {
  OperationsEventType,
  type OperationsEvent,
} from '@visaflow/shared-types';
import { randomUUID } from 'node:crypto';

@Injectable()
export class OperationsEventsService {
  private readonly logger = new Logger(OperationsEventsService.name);
  private readonly eventSubject$ = new Subject<OperationsEvent>();

  publish(event: OperationsEvent): void {
    this.logger.debug(`Publishing operations event: ${event.type} for case: ${event.caseId}`);
    this.eventSubject$.next(event);
  }

  emit(type: OperationsEventType, caseId?: string, data: unknown = {}): void {
    const event: OperationsEvent = {
      version: 1,
      eventId: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      caseId,
      data,
    };
    this.publish(event);
  }

  getEventStream(): Observable<MessageEvent> {
    const events$ = this.eventSubject$.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );

    // Heartbeat every 25 seconds to keep SSE connections alive
    const heartbeat$ = interval(25000).pipe(
      map(() => ({
        data: JSON.stringify({
          type: 'PING',
          occurredAt: new Date().toISOString(),
        }),
      } as MessageEvent)),
    );

    return merge(events$, heartbeat$);
  }
}
