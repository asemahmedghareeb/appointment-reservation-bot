import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from '../dashboard.service';
import type { DashboardRepository } from '../dashboard.repository';

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: Partial<DashboardRepository>;

  const mockCounts = {
    total: 10,
    monitoring: 4,
    waitingQueue: 2,
    slotFound: 1,
    paymentRequired: 1,
    confirmed: 2,
    needAttention: 2,
  };

  const mockRecentActivity = [
    {
      id: 'act-1',
      caseId: 'case-1',
      caseNumber: 'CASE-001',
      eventType: 'CASE_STATUS_CHANGED',
      message: 'Case status changed to MONITORING',
      timestamp: new Date().toISOString(),
    },
  ];

  const mockAttentionCases = [
    {
      caseId: 'case-2',
      caseNumber: 'CASE-002',
      provider: 'VFS' as const,
      destination: 'GRC',
      centre: 'CAI',
      reason: '2FA verification required',
      currentStatus: 'HUMAN_VERIFICATION_REQUIRED' as const,
      humanActionType: 'OTP',
      ageSeconds: 120,
      triggeredAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    repo = {
      getCounts: vi.fn().mockResolvedValue(mockCounts),
      getRecentActivity: vi.fn().mockResolvedValue(mockRecentActivity),
      getAttentionCases: vi.fn().mockResolvedValue(mockAttentionCases),
    };

    service = new DashboardService(repo as DashboardRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should aggregate counts, recent activity, and attention items', async () => {
    const result = await service.getSummary();

    expect(repo.getCounts).toHaveBeenCalled();
    expect(repo.getRecentActivity).toHaveBeenCalledWith(10);
    expect(repo.getAttentionCases).toHaveBeenCalledWith(10);

    expect(result.counts).toEqual(mockCounts);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.attentionItems).toHaveLength(1);
    expect(result.attentionItems[0]?.caseNumber).toBe('CASE-002');
  });
});

