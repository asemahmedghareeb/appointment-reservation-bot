import type { Browser, BrowserContext, Page } from 'playwright';

export interface VfsActiveSession {
  caseId: string;
  workerId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  currentPath?: string;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface SessionRestoreOptions {
  storageStateJson?: string;
  origin?: string;
}
