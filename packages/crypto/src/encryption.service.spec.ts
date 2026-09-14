import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from './encryption.service.js';
import {
  InvalidKeyError,
  DecryptionError,
  InvalidPayloadFormatError,
  CryptoError,
} from './crypto.errors.js';

describe('AES-256-GCM Encryption Service', () => {
  const validKey = randomBytes(32).toString('base64');
  const invalidShortKey = randomBytes(16).toString('base64');

  it('successfully completes round-trip encryption and decryption', () => {
    const original = 'A12345678';
    const encrypted = encrypt(original, validKey);

    expect(encrypted).toBeDefined();
    expect(encrypted).toContain('v1.');

    const decrypted = decrypt(encrypted, validKey);
    expect(decrypted).toBe(original);
  });

  it('produces randomized ciphertext for identical plaintext across calls (unique IV)', () => {
    const original = 'A123456';
    const cipher1 = encrypt(original, validKey);
    const cipher2 = encrypt(original, validKey);

    expect(cipher1).not.toBe(cipher2);
    expect(decrypt(cipher1, validKey)).toBe(original);
    expect(decrypt(cipher2, validKey)).toBe(original);
  });

  it('detects tampering with ciphertext and throws DecryptionError', () => {
    const original = 'SecretPassportData123';
    const encrypted = encrypt(original, validKey);

    const parts = encrypted.split('.');
    // Tamper with the ciphertext part by flipping a character
    const ct = parts[3]!;
    const tamperedCiphertext = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    const tamperedPayload = [parts[0], parts[1], parts[2], tamperedCiphertext].join('.');

    expect(() => decrypt(tamperedPayload, validKey)).toThrow(DecryptionError);
  });

  it('detects tampering with auth tag and throws DecryptionError', () => {
    const original = 'SecretPassportData123';
    const encrypted = encrypt(original, validKey);

    const parts = encrypted.split('.');
    // Tamper with the auth tag by flipping a character
    const origTag = parts[2]!;
    const tamperedTag = (origTag[0] === 'A' ? 'B' : 'A') + origTag.slice(1);
    const tamperedPayload = [parts[0], parts[1], tamperedTag, parts[3]].join('.');

    expect(() => decrypt(tamperedPayload, validKey)).toThrow(DecryptionError);
  });

  it('fails immediately when key length is invalid', () => {
    expect(() => encrypt('test', invalidShortKey)).toThrow(InvalidKeyError);
    expect(() => decrypt('v1.abc.def.ghi', invalidShortKey)).toThrow(InvalidKeyError);
  });

  it('rejects empty or invalid plaintext', () => {
    expect(() => encrypt('', validKey)).toThrow(CryptoError);
    expect(() => encrypt(null as unknown as string, validKey)).toThrow(CryptoError);
  });

  it('rejects malformed encrypted payload strings', () => {
    expect(() => decrypt('not-a-valid-payload', validKey)).toThrow(InvalidPayloadFormatError);
    expect(() => decrypt('v2.a.b.c', validKey)).toThrow(InvalidPayloadFormatError);
  });
});
