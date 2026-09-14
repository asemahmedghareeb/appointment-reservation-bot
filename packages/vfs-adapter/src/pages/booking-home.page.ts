import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export class BookingHomePage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.BOOKING_HOME;
  }

  async startNewBooking(): Promise<void> {
    this.log('Clicking Start New Booking');
    const btn = this.page.locator(VFS_SELECTORS.bookingHome.startNewBookingButton).first();
    await this.waitAndClick(btn);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  }
}
