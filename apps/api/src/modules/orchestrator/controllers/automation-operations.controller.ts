import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AutomationOperationsService } from '../services/automation-operations.service.js';
import { StartAutomationDto } from '../dto/start-automation.dto.js';
import { ResumeAutomationDto } from '../dto/resume-automation.dto.js';

@Controller('orchestrator/cases')
export class AutomationOperationsController {
  constructor(private readonly automationService: AutomationOperationsService) {}

  @Post(':caseId/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startAutomation(
    @Param('caseId') caseId: string,
    @Body() dto?: StartAutomationDto,
  ) {
    return this.automationService.startAutomation(caseId, dto);
  }

  @Post(':caseId/resume')
  @HttpCode(HttpStatus.ACCEPTED)
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
