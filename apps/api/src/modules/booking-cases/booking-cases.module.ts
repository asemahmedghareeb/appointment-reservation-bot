import { Module } from '@nestjs/common';
import { BookingCasesController } from './booking-cases.controller.js';
import { BookingCasesService } from './booking-cases.service.js';
import { BookingCasesRepository } from './booking-cases.repository.js';
import { CaseNumberService } from './case-number.service.js';
import { CaseReadinessService } from './case-readiness.service.js';
import { ProviderRoutesModule } from '../provider-routes/provider-routes.module.js';
import { ApplicantsModule } from '../applicants/applicants.module.js';

@Module({
  imports: [ProviderRoutesModule, ApplicantsModule],
  controllers: [BookingCasesController],
  providers: [
    BookingCasesService,
    BookingCasesRepository,
    CaseNumberService,
    CaseReadinessService,
  ],
  exports: [BookingCasesService, BookingCasesRepository, CaseReadinessService],
})
export class BookingCasesModule {}
