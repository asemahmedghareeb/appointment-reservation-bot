import { describe, it, expect } from 'vitest';
import { ErrorClassification } from '@visaflow/shared-types';
import { VfsErrorClassifier } from '../../src/reliability/vfs-error-classifier.js';
import { VfsAuthenticationError } from '../../src/errors/vfs-authentication.error.js';
import { VfsSessionError } from '../../src/errors/vfs-session.error.js';
import { VfsDetailedPageChangedError } from '../../src/reliability/vfs-page-change-detector.js';

describe('VfsErrorClassifier', () => {
  it('classifies network and navigation timeouts as TRANSIENT during read actions', () => {
    const err = new Error('Navigation timeout of 30000ms exceeded');
    const result = VfsErrorClassifier.classify(err, false);

    expect(result.classification).toBe(ErrorClassification.TRANSIENT);
    expect(result.isRetryable).toBe(true);
    expect(result.requiresInspection).toBe(false);
  });

  it('classifies network timeout as REMOTE_STATE_UNKNOWN during irreversible actions', () => {
    const err = new Error('net::ERR_CONNECTION_TIMED_OUT');
    const result = VfsErrorClassifier.classify(err, true);

    expect(result.classification).toBe(ErrorClassification.REMOTE_STATE_UNKNOWN);
    expect(result.isRetryable).toBe(false);
    expect(result.requiresInspection).toBe(true);
  });

  it('classifies human challenges as HUMAN_ACTION_REQUIRED and non-retryable', () => {
    const err = new Error('Cloudflare Turnstile captcha challenge detected');
    const result = VfsErrorClassifier.classify(err, false);

    expect(result.classification).toBe(ErrorClassification.HUMAN_ACTION_REQUIRED);
    expect(result.isRetryable).toBe(false);
  });

  it('classifies invalid credentials as PERMANENT', () => {
    const err = new VfsAuthenticationError('Invalid credentials provided for user');
    const result = VfsErrorClassifier.classify(err, false);

    expect(result.classification).toBe(ErrorClassification.PERMANENT);
    expect(result.isRetryable).toBe(false);
  });

  it('classifies session expiration as TRANSIENT retryable', () => {
    const err = new VfsSessionError('Session expired due to inactivity', 'case-1');
    const result = VfsErrorClassifier.classify(err, false);

    expect(result.classification).toBe(ErrorClassification.TRANSIENT);
    expect(result.isRetryable).toBe(true);
  });

  it('classifies page layout changes as PERMANENT requiring inspection if irreversible', () => {
    const err = new VfsDetailedPageChangedError('APPLICANT_DETAILS', 'UNKNOWN', {
      safePath: '/unknown',
      sanitizedTitle: 'Error',
      missingSelectors: ['#first-name'],
      detectedHeadings: [],
      timestamp: new Date().toISOString(),
    });
    const result = VfsErrorClassifier.classify(err, true);

    expect(result.classification).toBe(ErrorClassification.PERMANENT);
    expect(result.isRetryable).toBe(false);
    expect(result.requiresInspection).toBe(true);
  });
});
