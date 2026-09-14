import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { OperationalHealthService } from '../modules/operations/health/operational-health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly operationalHealthService: OperationalHealthService) {}

  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  @Get('live')
  getLiveness() {
    return this.operationalHealthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const report = await this.operationalHealthService.getReadiness();
    if (report.status === 'DOWN') {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(report);
    }
    return res.status(HttpStatus.OK).json(report);
  }
}
