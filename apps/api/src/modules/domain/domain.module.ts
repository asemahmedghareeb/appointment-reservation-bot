import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module.js';
import { ApplicantsModule } from '../applicants/applicants.module.js';
import { ProviderRoutesModule } from '../provider-routes/provider-routes.module.js';
import { BookingCasesModule } from '../booking-cases/booking-cases.module.js';

@Module({
  imports: [
    ClientsModule,
    ApplicantsModule,
    ProviderRoutesModule,
    BookingCasesModule,
  ],
  exports: [
    ClientsModule,
    ApplicantsModule,
    ProviderRoutesModule,
    BookingCasesModule,
  ],
})
export class DomainModule {}
