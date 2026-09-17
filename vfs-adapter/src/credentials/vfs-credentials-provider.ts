export interface VfsCredentials {
  username?: string;
  email?: string;
  password: string;
}

export interface VfsCredentialsProvider {
  getCredentials(providerAccountId: string): Promise<VfsCredentials>;
}
