import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { PaymentPageDetector, type PaymentPageDetectionResult } from '../detection/payment-page.detector.js';

export class PaymentPage extends BaseVfsPage {
  private readonly detector = new PaymentPageDetector();

  get expectedPageType(): VfsPageType {
    return VfsPageType.PAYMENT;
  }

  async getPaymentDetails(): Promise<PaymentPageDetectionResult> {
    this.log('Extracting payment metadata without card interaction');
    return this.detector.detect(this.page);
  }
}
