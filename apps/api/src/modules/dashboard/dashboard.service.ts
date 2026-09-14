import { Injectable, Logger } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';
import type { DashboardSummary } from '@visaflow/shared-types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly dashboardRepo: DashboardRepository) {}

  async getSummary(): Promise<DashboardSummary> {
    this.logger.debug('Fetching dashboard summary');
    const [counts, recentActivity, attentionItems] = await Promise.all([
      this.dashboardRepo.getCounts(),
      this.dashboardRepo.getRecentActivity(10),
      this.dashboardRepo.getAttentionCases(10),
    ]);

    return {
      counts,
      recentActivity,
      attentionItems,
    };
  }
}
