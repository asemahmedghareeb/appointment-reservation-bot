import type { Page, Locator } from 'playwright';
import { VfsPageClassifier, VfsPageType } from '../detection/vfs-page-classifier.js';
import { HumanVerificationDetector, type HumanVerificationDetectionResult } from '../detection/human-verification.detector.js';
import { VfsPageChangedError } from '../errors/vfs-page-changed.error.js';
import { logSafeBrowserEvent } from '../security/safe-browser-log.js';
import { getSafeUrl } from '../security/safe-url.js';

export abstract class BaseVfsPage {
  protected readonly classifier = new VfsPageClassifier();
  protected readonly humanDetector = new HumanVerificationDetector();

  constructor(public readonly page: Page) {}

  abstract get expectedPageType(): VfsPageType;

  async assertCurrentPage(): Promise<void> {
    const current = await this.classifier.classify(this.page);
    if (current !== this.expectedPageType) {
      throw new VfsPageChangedError(
        this.expectedPageType,
        current,
        getSafeUrl(this.page.url()),
      );
    }
  }

  async checkHumanVerification(): Promise<HumanVerificationDetectionResult> {
    return this.humanDetector.detect(this.page);
  }

  protected async waitAndClick(locator: Locator, timeoutMs: number = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    // Wait until enabled if button
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click();
  }

  protected async waitAndFill(locator: Locator, text: string, timeoutMs: number = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    await locator.fill(text);
  }

  protected log(event: string, meta?: Record<string, unknown>): void {
    logSafeBrowserEvent(event, {
      ...meta,
      currentUrl: getSafeUrl(this.page.url()),
      pageType: this.expectedPageType,
    });
  }
}
