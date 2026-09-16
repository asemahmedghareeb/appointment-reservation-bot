import {
  Controller,
  Param,
  Req,
  Sse,
  Header,
  type MessageEvent,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { LiveMonitorService } from './live-monitor.service.js';

@Controller('operations')
export class LiveMonitorController {
  constructor(private readonly liveMonitorService: LiveMonitorService) {}

  @Sse('cases/:caseId/live-stream')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('X-Accel-Buffering', 'no')
  async liveStream(
    @Param('caseId') caseId: string,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    return this.liveMonitorService.getLiveStream(caseId, req);
  }
}
