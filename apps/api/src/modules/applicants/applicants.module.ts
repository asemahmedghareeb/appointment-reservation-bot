import { Module } from '@nestjs/common';
import { ApplicantsController } from './applicants.controller.js';
import { ApplicantsService } from './applicants.service.js';
import { ApplicantsRepository } from './applicants.repository.js';
import { PassportValidationService } from './passport-validation.service.js';

@Module({
  controllers: [ApplicantsController],
  providers: [ApplicantsService, ApplicantsRepository, PassportValidationService],
  exports: [ApplicantsService, ApplicantsRepository, PassportValidationService],
})
export class ApplicantsModule {}
