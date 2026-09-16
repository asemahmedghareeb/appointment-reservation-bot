import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveMonitorService } from '../live-monitor/live-monitor.service.js';
import { NotFoundException } from '@nestjs/common';
import { prisma } from '@visaflow/database';
import { take } from 'rxjs';

vi.mock('@visaflow/database', () => ({
  prisma: {
    bookingCase: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../orchestrator/infrastructure/redis/redis-client.factory.js', () => ({
  createRedisClient: () => {
    const listeners: Record<string, Function> = {};
    return {
      psubscribe: vi.fn().mockResolvedValue('OK'),
      publish: vi.fn().mockResolvedValue(1),
      on: vi.fn().mockImplementation((event: string, handler: Function) => {
        listeners[event] = handler;
      }),
      quit: vi.fn().mockResolvedValue('OK'),
    };
  },
}));

describe('LiveMonitorService', () => {
  let service: LiveMonitorService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new LiveMonitorService();
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('throws NotFoundException if the requested booking case does not exist', async () => {
    vi.mocked(prisma.bookingCase.findUnique).mockResolvedValueOnce(null);

    await expect(service.getLiveStream('nonexistent-case')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('emits initial status CONNECTING upon client subscription', async () => {
    vi.mocked(prisma.bookingCase.findUnique).mockResolvedValueOnce({
      id: 'case-123',
      caseNumber: 'VF-12345',
    } as any);

    const stream$ = await service.getLiveStream('case-123');

    return new Promise<void>((resolve, reject) => {
      stream$.pipe(take(1)).subscribe({
        next: (event) => {
          try {
            expect(event.type).toBe('status');
            const data = JSON.parse(event.data as string);
            expect(data.status).toBe('CONNECTING');
            expect(data.caseId).toBe('case-123');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: reject,
      });
    });
  });

  it('tracks active viewer count and cleans up when all viewers disconnect', async () => {
    vi.mocked(prisma.bookingCase.findUnique).mockResolvedValue({
      id: 'case-viewers',
      caseNumber: 'VF-999',
    } as any);

    const stream$ = await service.getLiveStream('case-viewers');

    // Viewer 1 connects
    const sub1 = stream$.subscribe();
    expect(service.getActiveViewerCount('case-viewers')).toBe(1);

    // Viewer 2 connects
    const sub2 = stream$.subscribe();
    expect(service.getActiveViewerCount('case-viewers')).toBe(2);

    // Viewer 1 disconnects
    sub1.unsubscribe();
    expect(service.getActiveViewerCount('case-viewers')).toBe(1);

    // Viewer 2 disconnects
    sub2.unsubscribe();
    expect(service.getActiveViewerCount('case-viewers')).toBe(0);
  });
});
