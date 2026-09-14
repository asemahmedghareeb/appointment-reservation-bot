import { ErrorClassification } from '@visaflow/shared-types';
import { VfsErrorClassifier } from '@visaflow/vfs-adapter';

export class WorkerErrorClassifier {

  static classify(error: unknown): ErrorClassification {
    if (!error) {
      return ErrorClassification.REMOTE_STATE_UNKNOWN;
    }

    const err = error as Record<string, any>;
    const message = (err.message || String(error)).toLowerCase();
    const name = (err.name || '').toLowerCase();
    const code = (err.code || '').toLowerCase();

    // 1. Human action required
    if (
      message.includes('turnstile') ||
      message.includes('captcha') ||
      message.includes('otp') ||
      message.includes('human verification') ||
      code === 'human_action_required' ||
      err.kind === 'HUMAN_ACTION_REQUIRED'
    ) {
      return ErrorClassification.HUMAN_ACTION_REQUIRED;
    }

    // 2. Permanent errors
    if (
      message.includes('invalid credentials') ||
      message.includes('unauthorized') ||
      message.includes('account locked') ||
      message.includes('disabled provider') ||
      code === 'invalid_credentials' ||
      code === 'auth_failed'
    ) {
      return ErrorClassification.PERMANENT;
    }

    // 3. Configuration errors
    if (
      message.includes('configuration') ||
      message.includes('missing environment') ||
      message.includes('route not found') ||
      message.includes('unsupported provider')
    ) {
      return ErrorClassification.CONFIGURATION;
    }

    // 4. Infrastructure errors (DB / Redis connection lost)
    if (
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('connection lost') ||
      message.includes('redis') ||
      name.includes('prisma') ||
      code === 'p1001' || // Prisma connection error
      code === 'p1002' ||
      code === 'econnreset'
    ) {
      return ErrorClassification.INFRASTRUCTURE;
    }

    // 5. Transient errors (timeouts, network blips, navigation timeout)
    if (
      message.includes('timeout') ||
      message.includes('navigation timeout') ||
      message.includes('page closed') ||
      message.includes('target closed') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return ErrorClassification.TRANSIENT;
    }

    // Try VFS adapter classifier if applicable
    const vfsResult = VfsErrorClassifier.classify(error);
    if (vfsResult.classification !== ErrorClassification.PERMANENT || vfsResult.isRetryable) {
      return vfsResult.classification;
    }

    return ErrorClassification.REMOTE_STATE_UNKNOWN;
  }
}
