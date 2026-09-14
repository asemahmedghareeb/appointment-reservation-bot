import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { VfsRouteSelectionCriteria } from '../mapping/vfs-route.mapper.js';
import { VfsRouteNotSupportedError } from '../errors/vfs-route-not-supported.error.js';

export class AppointmentDetailsPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.APPOINTMENT_DETAILS;
  }

  async selectRouteCriteria(criteria: VfsRouteSelectionCriteria): Promise<void> {
    this.log('Selecting appointment route details', { ...criteria });

    const centreSelect = this.page.locator(VFS_SELECTORS.appointmentDetails.centreSelect).first();
    const categorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.categorySelect).first();
    const subcategorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.subcategorySelect).first();

    try {
      if (await centreSelect.count() > 0) {
        await centreSelect.selectOption({ label: criteria.centre }).catch(async () => {
          await centreSelect.selectOption({ value: criteria.centre });
        });
      }

      if (await categorySelect.count() > 0) {
        await categorySelect.selectOption({ label: criteria.category }).catch(async () => {
          await categorySelect.selectOption({ value: criteria.category });
        });
      }

      if (await subcategorySelect.count() > 0) {
        await subcategorySelect.selectOption({ label: criteria.subcategory }).catch(async () => {
          await subcategorySelect.selectOption({ value: criteria.subcategory });
        });
      }

      const continueBtn = this.page.locator(VFS_SELECTORS.appointmentDetails.continueButton).first();
      await this.waitAndClick(continueBtn);
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    } catch (err: any) {
      throw new VfsRouteNotSupportedError(
        `Failed to select route criteria (${criteria.centre} / ${criteria.category} / ${criteria.subcategory}): ${err.message}`,
      );
    }
  }
}
