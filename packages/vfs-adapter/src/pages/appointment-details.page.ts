import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { VfsRouteSelectionCriteria } from '../mapping/vfs-route.mapper.js';
import { VfsRouteNotSupportedError } from '../errors/vfs-route-not-supported.error.js';

export class AppointmentDetailsPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.APPOINTMENT_DETAILS;
  }

  private async selectDropdownOption(
    locator: ReturnType<typeof this.page.locator>,
    valueOrText: string,
  ): Promise<void> {
    if (await locator.count() === 0) return;

    const el = locator.first();
    const tagName = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => '');

    if (tagName === 'select') {
      await el.selectOption({ label: valueOrText }).catch(async () => {
        await el.selectOption({ value: valueOrText });
      });
      return;
    }

    // Angular Material mat-select or custom combobox
    await this.waitAndClick(el);
    await this.page.waitForTimeout(300);

    // Look for mat-option or role="option" matching target text
    const option = this.page
      .locator('mat-option, [role="option"], .mat-mdc-option')
      .filter({ hasText: valueOrText })
      .first();

    if (await option.count() > 0) {
      await this.waitAndClick(option);
    } else {
      // Fallback to first available option
      const firstOpt = this.page.locator('mat-option, [role="option"], .mat-mdc-option').first();
      if (await firstOpt.count() > 0) {
        await this.waitAndClick(firstOpt);
      }
    }
    await this.page.waitForTimeout(300);
  }

  async selectRouteCriteria(criteria: VfsRouteSelectionCriteria): Promise<void> {
    this.log('Selecting appointment route details', { ...criteria });

    const centreSelect = this.page.locator(VFS_SELECTORS.appointmentDetails.centreSelect);
    const categorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.categorySelect);
    const subcategorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.subcategorySelect);

    try {
      await this.selectDropdownOption(centreSelect, criteria.centre);
      await this.selectDropdownOption(categorySelect, criteria.category);
      await this.selectDropdownOption(subcategorySelect, criteria.subcategory);

      const continueBtn = this.page.locator(VFS_SELECTORS.appointmentDetails.continueButton).first();
      if (await continueBtn.count() > 0 && await continueBtn.isVisible().catch(() => false)) {
        await this.waitAndClick(continueBtn);
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      }
    } catch (err: any) {
      throw new VfsRouteNotSupportedError(
        `Failed to select route criteria (${criteria.centre} / ${criteria.category} / ${criteria.subcategory}): ${err.message}`,
      );
    }
  }
}
