import { Queue, type QueueOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { QUEUE_NAMES, DEFAULT_QUEUE_PREFIX } from './queue.names.js';

export class QueueFactory {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly redisClient: Redis,
    private readonly prefix: string = DEFAULT_QUEUE_PREFIX,
  ) {}

  getQueue(name: string, optionsOverride?: Partial<QueueOptions>): Queue {
    const queueKey = `${this.prefix}:${name}`;
    let queue = this.queues.get(queueKey);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.redisClient,
        prefix: this.prefix,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
        ...optionsOverride,
      });
      this.queues.set(queueKey, queue);
    }
    return queue;
  }

  getAvailabilityQueue(optionsOverride?: Partial<QueueOptions>): Queue {
    return this.getQueue(QUEUE_NAMES.AVAILABILITY_CHECK, optionsOverride);
  }

  getBookingQueue(optionsOverride?: Partial<QueueOptions>): Queue {
    return this.getQueue(QUEUE_NAMES.BOOKING_EXECUTION, optionsOverride);
  }

  getResumeQueue(optionsOverride?: Partial<QueueOptions>): Queue {
    return this.getQueue(QUEUE_NAMES.SESSION_RESUME, optionsOverride);
  }

  async closeAll(): Promise<void> {
    for (const [, queue] of this.queues) {
      await queue.close().catch(() => {});
    }
    this.queues.clear();
  }
}
