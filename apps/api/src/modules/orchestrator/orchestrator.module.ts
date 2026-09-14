import { Module, Global } from '@nestjs/common';
import {
  REDIS_LOCK_CLIENT,
  REDIS_QUEUE_CLIENT,
} from './infrastructure/redis/redis.tokens.js';
import {
  createRedisLockClient,
  createRedisQueueClient,
} from './infrastructure/redis/redis-client.factory.js';
import { CaseLockService } from './infrastructure/locks/case-lock.service.js';
import { OrchestrationQueueService } from './infrastructure/queues/orchestration-queue.service.js';
import { OrchestratorRepository } from './repositories/orchestrator.repository.js';
import { CaseTransitionService } from './services/case-transition.service.js';
import { IdempotencyGuardService } from './services/idempotency-guard.service.js';
import { ProviderAdapterResolver } from './services/provider-adapter-resolver.service.js';
import { OrchestrationEngineService } from './services/orchestration-engine.service.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_LOCK_CLIENT,
      useFactory: () => createRedisLockClient(),
    },
    {
      provide: REDIS_QUEUE_CLIENT,
      useFactory: () => createRedisQueueClient(),
    },
    CaseLockService,
    OrchestrationQueueService,
    OrchestratorRepository,
    CaseTransitionService,
    IdempotencyGuardService,
    ProviderAdapterResolver,
    OrchestrationEngineService,
  ],
  exports: [
    REDIS_LOCK_CLIENT,
    REDIS_QUEUE_CLIENT,
    CaseLockService,
    OrchestrationQueueService,
    OrchestratorRepository,
    CaseTransitionService,
    IdempotencyGuardService,
    ProviderAdapterResolver,
    OrchestrationEngineService,
  ],
})
export class OrchestratorModule {}
