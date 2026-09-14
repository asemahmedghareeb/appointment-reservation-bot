export interface EncryptedField {
  readonly encryptedValue: string;
}

export interface SearchablePassportField {
  readonly passportNumberEncrypted: string;
  readonly passportNumberHash: string;
}

export interface EncryptedProviderAccountCredentials {
  readonly passwordEncrypted: string;
}
