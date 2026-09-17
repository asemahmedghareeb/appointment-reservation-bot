import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';

export class BookingHomePage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.BOOKING_HOME;
  }

  async startNewBooking(): Promise<void> {
    this.log('Clicking Start New Booking');
    // Specifically target the visible button on page (avoid hidden mobile duplicate)
    const visibleBtn = this.page
      .locator('button:has-text("Start New Booking"):visible, a:has-text("Start New Booking"):visible, button:has-text("New Booking"):visible')
      .first();

    const targetBtn = (await visibleBtn.count()) > 0
      ? visibleBtn
      : this.page.locator(VFS_SELECTORS.bookingHome.startNewBookingButton).first();

    await this.waitAndClick(targetBtn, 20000);
    this.log('Clicked Start New Booking, waiting for application-detail navigation...');

    await Promise.race([
      this.page.waitForURL((url) => url.pathname.includes('/application-detail'), { timeout: 25000 }).catch(() => {}),
      this.page.waitForSelector('mat-select, select', { timeout: 25000 }).catch(() => {}),
    ]);
    await this.page.waitForTimeout(2000);
  }
}
