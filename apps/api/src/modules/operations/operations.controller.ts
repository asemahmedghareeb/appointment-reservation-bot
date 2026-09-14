import {
  Controller,
  Get,
  Param,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { OperationsService } from './operations.service.js';
import { OperationsEventsService } from './operations-events.service.js';
import { ProviderHealthService } from './health/provider-health.service.js';
import { QueueHealthService } from './health/queue-health.service.js';
import { RecoveryService } from './recovery/recovery.service.js';
import type {
  OperationsCaseDetail,
  CaseTimelineItem,
  AttentionItem,
} from '@visaflow/shared-types';

@Controller('operations')
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly operationsEventsService: OperationsEventsService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly queueHealthService: QueueHealthService,
    private readonly recoveryService: RecoveryService,
  ) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.operationsEventsService.getEventStream();
  }

  @Get('cases/:caseId')
  async getCaseDetail(
    @Param('caseId') caseId: string,
  ): Promise<OperationsCaseDetail> {
    return this.operationsService.getCaseDetail(caseId);
  }

  @Get('cases/:caseId/timeline')
  async getCaseTimeline(
    @Param('caseId') caseId: string,
  ): Promise<CaseTimelineItem[]> {
    return this.operationsService.getCaseTimeline(caseId);
  }

  @Get('attention')
  async getAttentionList(
    @Query('limit') limit?: string,
  ): Promise<AttentionItem[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.operationsService.getAttentionList(parsedLimit);
  }

  @Get('providers/health')
  async getProvidersHealth() {
    return this.providerHealthService.getAllProvidersHealth();
  }

  @Get('queue/health')
  async getQueueHealth() {
    return this.queueHealthService.getQueueHealth();
  }

  @Get('recovery/candidates')
  async getRecoveryCandidates() {
    return this.recoveryService.getRecoveryCandidates();
  }
}
