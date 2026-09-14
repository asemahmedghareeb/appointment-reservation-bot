import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import {
  AES_ALGORITHM,
  AES_IV_LENGTH_BYTES,
  AES_AUTH_TAG_LENGTH_BYTES,
  AES_KEY_LENGTH_BYTES,
  ENCRYPTED_PAYLOAD_PREFIX,
} from './crypto.constants.js';
import {
  CryptoError,
  InvalidKeyError,
  DecryptionError,
  InvalidPayloadFormatError,
} from './crypto.errors.js';
import { getEnv } from '@visaflow/config';

function resolveKey(keyOverride?: string | Buffer): Buffer {
  let keyBuf: Buffer;

  if (keyOverride) {
    if (Buffer.isBuffer(keyOverride)) {
      keyBuf = keyOverride;
    } else {
      keyBuf = Buffer.from(keyOverride, 'base64');
      // If base64 decode yielded wrong length, check if it was raw 32-byte utf8 string
      if (keyBuf.length !== AES_KEY_LENGTH_BYTES && Buffer.from(keyOverride, 'utf8').length === AES_KEY_LENGTH_BYTES) {
        keyBuf = Buffer.from(keyOverride, 'utf8');
      }
    }
  } else {
    let envKey = process.env.DATA_ENCRYPTION_KEY;
    if (!envKey) {
      try {
        envKey = getEnv().DATA_ENCRYPTION_KEY;
      } catch {
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
          envKey = 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=';
        }
      }
    }
    if (!envKey) {
      throw new InvalidKeyError('DATA_ENCRYPTION_KEY is required for encryption');
    }
    keyBuf = Buffer.from(envKey, 'base64');
  }

  if (keyBuf.length !== AES_KEY_LENGTH_BYTES) {
    throw new InvalidKeyError(
      `Encryption key must be exactly ${AES_KEY_LENGTH_BYTES} bytes. Received ${keyBuf.length} bytes.`,
    );
  }

  return keyBuf;
}

/**
 * Encrypts plaintext using authenticated AES-256-GCM.
 * Output format: v1.<iv_base64url>.<authTag_base64url>.<ciphertext_base64url>
 */
export function encrypt(plaintext: string, keyOverride?: string | Buffer): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new CryptoError('Plaintext must be a non-empty string');
  }

  const key = resolveKey(keyOverride);
  const iv = randomBytes(AES_IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PAYLOAD_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Decrypts a versioned AES-256-GCM payload.
 * Verifies authenticity before returning the decrypted string.
 */
export function decrypt(payload: string, keyOverride?: string | Buffer): string {
  const key = resolveKey(keyOverride);

  if (typeof payload !== 'string' || payload.length === 0) {
    throw new InvalidPayloadFormatError('Payload must be a non-empty string');
  }

  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== ENCRYPTED_PAYLOAD_PREFIX) {
    throw new InvalidPayloadFormatError(
      `Invalid payload format. Expected ${ENCRYPTED_PAYLOAD_PREFIX}.<iv>.<tag>.<ciphertext>`,
    );
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new InvalidPayloadFormatError('Payload parts must not be empty');
  }

  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(authTagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  if (iv.length !== AES_IV_LENGTH_BYTES) {
    throw new InvalidPayloadFormatError(`Invalid IV length. Expected ${AES_IV_LENGTH_BYTES} bytes.`);
  }

  if (authTag.length !== AES_AUTH_TAG_LENGTH_BYTES) {
    throw new InvalidPayloadFormatError(`Invalid auth tag length. Expected ${AES_AUTH_TAG_LENGTH_BYTES} bytes.`);
  }

  try {
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new DecryptionError('Decryption failed: payload has been tampered with or key is incorrect');
  }
}
