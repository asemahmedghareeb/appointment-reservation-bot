import { describe, it, expect } from 'vitest';
import { SafePiiRedactor } from '../../src/observability/safe-logger.js';

describe('SafePiiRedactor', () => {
  it('redacts sensitive passport fields in objects', () => {
    const payload = {
      caseId: 'case-123',
      passportNumber: 'N98765432',
      passportNumberEncrypted: 'v1.iv.tag.ct',
      clientName: 'Alice',
    };

    const redacted = SafePiiRedactor.redact(payload) as any;
    expect(redacted.caseId).toBe('case-123');
    expect(redacted.clientName).toBe('Alice');
    expect(redacted.passportNumber).toBe('[REDACTED]');
    expect(redacted.passportNumberEncrypted).toBe('[REDACTED]');
  });

  it('redacts nested passwords, cookies, and tokens', () => {
    const payload = {
      credentials: {
        username: 'user@test.com',
        password: 'SuperSecretPassword123!',
      },
      session: {
        storageState: '{"cookies": [{"name": "session", "value": "secret"}]}',
        token: 'eyJh...',
      },
    };

    const redacted = SafePiiRedactor.redact(payload) as any;
    expect(redacted.credentials.username).toBe('user@test.com');
    expect(redacted.credentials.password).toBe('[REDACTED]');
    expect(redacted.session.storageState).toBe('[REDACTED]');
    expect(redacted.session.token).toBe('[REDACTED]');
  });

  it('masks passport strings embedded in text', () => {
    const text = 'Failed to submit applicant with passport A12345678 due to timeout';
    const redacted = SafePiiRedactor.redact(text) as string;

    expect(redacted).not.toContain('A12345678');
    expect(redacted).toContain('A1****78');
  });

  it('serializes errors safely without leaking password in message', () => {
    const err = new Error('Authentication failed for password=MyTopSecretPassword');
    const serialized = SafePiiRedactor.serializeError(err);

    expect(serialized.name).toBe('Error');
    expect(serialized.message).not.toContain('MyTopSecretPassword');
    expect(serialized.message).toContain('[REDACTED_PASSWORD]');
  });
});
