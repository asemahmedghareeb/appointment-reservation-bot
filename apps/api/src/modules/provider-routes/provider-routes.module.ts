import { Module } from '@nestjs/common';
import { ProviderRoutesController } from './provider-routes.controller.js';
import { ProviderRoutesService } from './provider-routes.service.js';
import { ProviderRoutesRepository } from './provider-routes.repository.js';

@Module({
  controllers: [ProviderRoutesController],
  providers: [ProviderRoutesService, ProviderRoutesRepository],
  exports: [ProviderRoutesService, ProviderRoutesRepository],
})
export class ProviderRoutesModule {}
