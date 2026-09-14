import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { DashboardSummary } from '@visaflow/shared-types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }

  @Get()
  async getDashboard(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary();
  }
}
