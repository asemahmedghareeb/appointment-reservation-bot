import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { ConfirmationPageDetector, type ConfirmationDetectionResult } from '../detection/confirmation-page.detector.js';

export class ConfirmationPage extends BaseVfsPage {
  private readonly detector = new ConfirmationPageDetector();

  get expectedPageType(): VfsPageType {
    return VfsPageType.CONFIRMATION;
  }

  async getConfirmationDetails(): Promise<ConfirmationDetectionResult> {
    this.log('Extracting booking confirmation details');
    return this.detector.detect(this.page);
  }
}
