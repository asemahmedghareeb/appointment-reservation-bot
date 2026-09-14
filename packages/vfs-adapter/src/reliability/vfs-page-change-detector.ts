import type { Page } from 'playwright';
import { VfsPageChangedError } from '../errors/vfs-page-changed.error.js';

export interface PageDiagnostics {
  safePath: string;
  sanitizedTitle: string;
  missingSelectors: string[];
  detectedHeadings: string[];
  timestamp: string;
}

export class VfsDetailedPageChangedError extends VfsPageChangedError {
  public readonly diagnostics: PageDiagnostics;

  constructor(expectedPage: string, actualPage: string, diagnostics: PageDiagnostics) {
    super(expectedPage, actualPage, diagnostics.safePath);
    this.name = 'VfsDetailedPageChangedError';
    this.diagnostics = diagnostics;
  }
}

export class VfsPageChangeDetector {
  static async captureDiagnostics(
    page: Page,
    expectedSelectors: string[],
  ): Promise<PageDiagnostics> {
    let safePath = 'UNKNOWN_PATH';
    let sanitizedTitle = 'UNKNOWN_TITLE';
    const detectedHeadings: string[] = [];
    const missingSelectors: string[] = [];

    try {
      const url = new URL(page.url());
      safePath = url.pathname;
    } catch {
      safePath = 'INVALID_URL';
    }

    try {
      const rawTitle = await page.title();
      sanitizedTitle = rawTitle.replace(/[0-9a-zA-Z._%+-]+@[0-9a-zA-Z.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]').slice(0, 100);
    } catch {
      sanitizedTitle = 'UNABLE_TO_READ_TITLE';
    }

    for (const selector of expectedSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count === 0) {
          missingSelectors.push(selector);
        }
      } catch {
        missingSelectors.push(selector);
      }
    }

    try {
      const headings = await page.locator('h1, h2').allInnerTexts();
      for (const h of headings.slice(0, 5)) {
        const sanitized = h.trim().replace(/\d{4,}/g, '****');
        if (sanitized.length > 0 && sanitized.length < 100) {
          detectedHeadings.push(sanitized);
        }
      }
    } catch {
      // ignore
    }

    return {
      safePath,
      sanitizedTitle,
      missingSelectors,
      detectedHeadings,
      timestamp: new Date().toISOString(),
    };
  }

  static async assertPageStructure(
    page: Page,
    requiredSelectors: string[],
    pageDescription: string,
  ): Promise<void> {
    const missing: string[] = [];
    for (const selector of requiredSelectors) {
      const count = await page.locator(selector).count();
      if (count === 0) {
        missing.push(selector);
      }
    }

    if (missing.length === requiredSelectors.length && requiredSelectors.length > 0) {
      const diagnostics = await this.captureDiagnostics(page, requiredSelectors);
      throw new VfsDetailedPageChangedError(
        pageDescription,
        'UNRECOGNIZED_LAYOUT',
        diagnostics,
      );
    }
  }
}
