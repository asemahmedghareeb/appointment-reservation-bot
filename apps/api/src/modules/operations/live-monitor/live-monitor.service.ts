import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  type OnModuleDestroy,
  type MessageEvent,
} from '@nestjs/common';
import { Observable, type Subscriber } from 'rxjs';
import { Redis } from 'ioredis';
import { prisma } from '@visaflow/database';
import { createRedisClient } from '../../orchestrator/infrastructure/redis/redis-client.factory.js';

export interface LiveSignalPayload {
  type: 'START_VIEWING' | 'STOP_VIEWING' | 'HEARTBEAT';
  caseId: string;
}

interface CaseViewerState {
  caseId: string;
  viewers: Set<Subscriber<MessageEvent>>;
  heartbeatTimer?: NodeJS.Timeout;
  lastFrameMessage?: string;
}

@Injectable()
export class LiveMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveMonitorService.name);
  private subscriberClient?: Redis;
  private publisherClient?: Redis;
  private readonly activeCases = new Map<string, CaseViewerState>();

  async onModuleInit(): Promise<void> {
    try {
      this.subscriberClient = createRedisClient();
      this.publisherClient = createRedisClient();

      this.subscriberClient.on('error', (err) => {
        this.logger.warn(`Redis subscriber error: ${err.message}`);
      });

      this.publisherClient.on('error', (err) => {
        this.logger.warn(`Redis publisher error: ${err.message}`);
      });

      this.subscriberClient.on('pmessage', (_pattern, channel, message) => {
        try {
          const caseId = channel.slice('visaflow:live-frames:'.length);
          if (!caseId) return;

          let state = this.activeCases.get(caseId);
          if (!state) {
            state = {
              caseId,
              viewers: new Set<Subscriber<MessageEvent>>(),
            };
            this.activeCases.set(caseId, state);
          }

          state.lastFrameMessage = message;
          if (state.viewers.size === 0) return;

          const event: MessageEvent = {
            type: 'frame',
            data: message,
          };

          for (const viewer of state.viewers) {
            viewer.next(event);
          }
        } catch (err: any) {
          this.logger.warn(`Failed to route live frame for channel ${channel}: ${err.message}`);
        }
      });

      await this.subscriberClient.psubscribe('visaflow:live-frames:*');

      this.logger.log('LiveMonitorService initialized and listening for visual frames.');
    } catch (err: any) {
      this.logger.warn(`LiveMonitorService initialization failed: ${err.message}. Automation continues.`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const state of this.activeCases.values()) {
      if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
      }
      this.sendSignal('STOP_VIEWING', state.caseId);
    }
    this.activeCases.clear();

    try {
      await this.subscriberClient?.quit();
      await this.publisherClient?.quit();
    } catch {
      // Ignore cleanup error
    }
  }

  async getLiveStream(caseId: string, req?: any): Promise<Observable<MessageEvent>> {
    // 1. Authenticate & verify case exists
    const bookingCase = await prisma.bookingCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNumber: true },
    });

    if (!bookingCase) {
      throw new NotFoundException(`Booking case with ID ${caseId} not found`);
    }

    return new Observable<MessageEvent>((subscriber) => {
      let state = this.activeCases.get(caseId);

      if (!state) {
        state = {
          caseId,
          viewers: new Set<Subscriber<MessageEvent>>(),
        };
        this.activeCases.set(caseId, state);
      }

      state.viewers.add(subscriber);

      // Immediately push connecting status to this client
      subscriber.next({
        type: 'status',
        data: JSON.stringify({ status: 'CONNECTING', caseId }),
      });

      // If we already have a recent frame in API memory, immediately push it!
      if (state.lastFrameMessage) {
        subscriber.next({
          type: 'frame',
          data: state.lastFrameMessage,
        });
      }

      // Always signal worker that a viewer became active (idempotent on worker)
      this.sendSignal('START_VIEWING', caseId);

      // Ensure heartbeat timer is running while active viewers exist
      if (!state.heartbeatTimer) {
        state.heartbeatTimer = setInterval(() => {
          const current = this.activeCases.get(caseId);
          if (!current || current.viewers.size === 0) return;

          // If we haven't received a frame yet, re-assert START_VIEWING so worker picks up as soon as browser opens
          if (!current.lastFrameMessage) {
            this.sendSignal('START_VIEWING', caseId);
          } else {
            this.sendSignal('HEARTBEAT', caseId);
          }
        }, 2500);
      }

      let isCleanedUp = false;
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;

        const currentState = this.activeCases.get(caseId);
        if (!currentState) return;

        currentState.viewers.delete(subscriber);

        if (currentState.viewers.size === 0) {
          if (currentState.heartbeatTimer) {
            clearInterval(currentState.heartbeatTimer);
          }
          this.sendSignal('STOP_VIEWING', caseId);
          this.activeCases.delete(caseId);
        }
      };

      if (req) {
        req.on('close', cleanup);
      }

      return cleanup;
    });
  }

  private sendSignal(type: 'START_VIEWING' | 'STOP_VIEWING' | 'HEARTBEAT', caseId: string): void {
    if (!this.publisherClient) return;

    try {
      const payload: LiveSignalPayload = { type, caseId };
      this.publisherClient
        .publish(`visaflow:live-signals:${caseId}`, JSON.stringify(payload))
        .catch((err) => {
          this.logger.warn(`Failed to publish ${type} signal for ${caseId}: ${err.message}`);
        });
    } catch (err: any) {
      this.logger.warn(`Signal dispatch error for ${caseId}: ${err.message}`);
    }
  }

  // Helper for tests
  getActiveViewerCount(caseId: string): number {
    return this.activeCases.get(caseId)?.viewers.size ?? 0;
  }
}
