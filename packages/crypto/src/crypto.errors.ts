export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class InvalidKeyError extends CryptoError {
  constructor(message = 'Invalid encryption key length: must be exactly 32 bytes') {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

export class DecryptionError extends CryptoError {
  constructor(message = 'Decryption failed or payload has been tampered with') {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class InvalidPayloadFormatError extends CryptoError {
  constructor(message = 'Invalid encrypted payload format. Expected v1.<iv>.<tag>.<ciphertext>') {
    super(message);
    this.name = 'InvalidPayloadFormatError';
  }
}

export class NormalizationError extends CryptoError {
  constructor(message = 'Invalid input for normalization: input cannot be empty') {
    super(message);
    this.name = 'NormalizationError';
  }
}
