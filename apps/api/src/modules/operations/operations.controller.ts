import {
  Controller,
  Get,
  Param,
  Query,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { OperationsService } from './operations.service';
import { OperationsEventsService } from './operations-events.service';
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
}
