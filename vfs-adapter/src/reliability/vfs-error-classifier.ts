import { ErrorClassification, type ClassifiedErrorDetails } from '@visaflow/shared-types';
import { VfsAuthenticationError } from '../errors/vfs-authentication.error.js';
import { VfsSessionError } from '../errors/vfs-session.error.js';
import { VfsPageChangedError } from '../errors/vfs-page-changed.error.js';

export class VfsErrorClassifier {
  static classify(error: unknown, isIrreversibleAction = false): ClassifiedErrorDetails {
    if (!error) {
      return {
        classification: ErrorClassification.PERMANENT,
        message: 'Unknown empty error',
        isRetryable: false,
        requiresInspection: false,
        rawError: error,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    // 1. Page structure change
    if (error instanceof VfsPageChangedError || /VFS_PAGE_CHANGED/i.test(message)) {
      return {
        classification: ErrorClassification.PERMANENT,
        message,
        isRetryable: false,
        requiresInspection: isIrreversibleAction,
        rawError: error,
      };
    }

    // 2. Human verification challenges
    if (/captcha|turnstile|recaptcha|hcaptcha|otp|2fa|verification code|challenge|human verification/i.test(message)) {
      return {
        classification: ErrorClassification.HUMAN_ACTION_REQUIRED,
        message,
        isRetryable: false,
        requiresInspection: false,
        rawError: error,
      };
    }

    // 3. Session expired
    if (
      error instanceof VfsSessionError ||
      /session expired|logged out|unauthorized|please log in|session timeout/i.test(message)
    ) {
      return {
        classification: ErrorClassification.TRANSIENT,
        message,
        isRetryable: true,
        requiresInspection: false,
        rawError: error,
      };
    }

    // 4. Permanent authentication failure (invalid credentials)
    if (
      error instanceof VfsAuthenticationError ||
      /invalid credentials|wrong password|account locked|user not found|account disabled/i.test(message)
    ) {
      return {
        classification: ErrorClassification.PERMANENT,
        message,
        isRetryable: false,
        requiresInspection: false,
        rawError: error,
      };
    }

    // 5. Configuration issues
    if (/configuration|missing environment|allowed origins|invalid key/i.test(message)) {
      return {
        classification: ErrorClassification.CONFIGURATION,
        message,
        isRetryable: false,
        requiresInspection: false,
        rawError: error,
      };
    }

    // 6. Infrastructure issues (Redis, Database)
    if (/redis|postgres|prisma|econnrefused|pool timeout|database/i.test(message)) {
      return {
        classification: ErrorClassification.INFRASTRUCTURE,
        message,
        isRetryable: true,
        requiresInspection: isIrreversibleAction,
        rawError: error,
      };
    }

    // 7. Navigation timeouts & network disconnects
    const isNetworkOrTimeout =
      errorName === 'TimeoutError' ||
      /timeout|etimedout|enotfound|net::|socket hang up|econnreset|fetch failed/i.test(message);

    if (isNetworkOrTimeout) {
      // If error occurred during irreversible step (e.g. clicking confirm booking, submit payment),
      // we do NOT know if the provider processed it!
      if (isIrreversibleAction) {
        return {
          classification: ErrorClassification.REMOTE_STATE_UNKNOWN,
          message: `Network/Timeout during irreversible action: ${message}`,
          isRetryable: false,
          requiresInspection: true,
          rawError: error,
        };
      }

      return {
        classification: ErrorClassification.TRANSIENT,
        message,
        isRetryable: true,
        requiresInspection: false,
        rawError: error,
      };
    }

    // 8. Fallback: Permanent by default to prevent reckless blind retries
    return {
      classification: ErrorClassification.PERMANENT,
      message,
      isRetryable: false,
      requiresInspection: isIrreversibleAction,
      rawError: error,
    };
  }
}
