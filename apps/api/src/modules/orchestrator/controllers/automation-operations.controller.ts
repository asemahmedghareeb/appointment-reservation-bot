import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AutomationOperationsService } from '../services/automation-operations.service.js';
import { StartAutomationDto } from '../dto/start-automation.dto.js';
import { ResumeAutomationDto } from '../dto/resume-automation.dto.js';
import { IdempotencyGuard } from '../../../common/guards/idempotency.guard.js';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard.js';

// 5 automation starts per 60 seconds per IP
const automationStartLimiter = new RateLimitGuard({ windowMs: 60_000, limit: 5 });
// 10 resume actions per 60 seconds per IP
const automationResumeLimiter = new RateLimitGuard({ windowMs: 60_000, limit: 10 });

@Controller('orchestrator/cases')
export class AutomationOperationsController {
  constructor(private readonly automationService: AutomationOperationsService) {}

  @Post(':caseId/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(IdempotencyGuard)
  async startAutomation(
    @Param('caseId') caseId: string,
    @Body() dto?: StartAutomationDto,
  ) {
    return this.automationService.startAutomation(caseId, dto);
  }

  @Post(':caseId/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(IdempotencyGuard)
  async resumeAutomation(
    @Param('caseId') caseId: string,
    @Body() dto?: ResumeAutomationDto,
  ) {
    return this.automationService.resumeAutomation(caseId, dto);
  }

  @Get(':caseId/session')
  async getSession(@Param('caseId') caseId: string) {
    return this.automationService.getSession(caseId);
  }
}
