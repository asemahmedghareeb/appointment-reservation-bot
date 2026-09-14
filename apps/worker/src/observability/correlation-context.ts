import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  correlationId: string;
  caseId?: string | undefined;
  workerId?: string | undefined;
  operation?: string | undefined;
  provider?: string | undefined;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

export class CorrelationContextManager {
  static run<T>(context: CorrelationContext, fn: () => T): T {
    return asyncLocalStorage.run(context, fn);
  }

  static get(): CorrelationContext | undefined {
    return asyncLocalStorage.getStore();
  }

  static getCorrelationId(): string {
    return asyncLocalStorage.getStore()?.correlationId || 'system-unassigned';
  }
}
