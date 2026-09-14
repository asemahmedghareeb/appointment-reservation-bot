import { decrypt } from '@visaflow/crypto';
import type { VfsCredentialsProvider, VfsCredentials } from '@visaflow/vfs-adapter';
import type { WorkerRepository } from '../repositories/worker.repository.js';

export class SecureProviderAccountService implements VfsCredentialsProvider {
  constructor(private readonly repo: WorkerRepository) {}

  async getCredentials(providerAccountId: string): Promise<VfsCredentials> {
    const account = await this.repo.findProviderAccount(providerAccountId);
    if (!account) {
      throw new Error(`ProviderAccount not found: ${providerAccountId}`);
    }

    if (!account.active) {
      throw new Error(`ProviderAccount ${providerAccountId} is inactive`);
    }

    let passwordPlaintext: string;
    try {
      passwordPlaintext = decrypt(account.passwordEncrypted);
    } catch {
      throw new Error(`Failed to decrypt password for ProviderAccount: ${providerAccountId}`);
    }

    return {
      ...(account.email ? { email: account.email } : {}),
      ...(account.username ? { username: account.username } : {}),
      password: passwordPlaintext,
    };

  }
}
