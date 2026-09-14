import { Module, Global } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { OperationsEventsService } from './operations-events.service';
import { OperationsController } from './operations.controller';

@Global()
@Module({
  controllers: [OperationsController],
  providers: [OperationsService, OperationsEventsService],
  exports: [OperationsService, OperationsEventsService],
})
export class OperationsModule {}
