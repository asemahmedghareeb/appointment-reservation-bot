import { Global, Module } from '@nestjs/common';
import { CurrentUserService } from './context/current-user.service.js';

@Global()
@Module({
  providers: [CurrentUserService],
  exports: [CurrentUserService],
})
export class CommonModule {}
