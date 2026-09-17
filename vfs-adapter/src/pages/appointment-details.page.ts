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
    const el = locator.first();
    const isVisible = await el.isVisible({ timeout: 15000 }).catch(() => false);
    if (!isVisible) {
      this.log('Dropdown not visible, skipping selection', { target: valueOrText });
      return;
    }

    const tagName = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => '');

    if (tagName === 'select') {
      await el.selectOption({ label: valueOrText }).catch(async () => {
        await el.selectOption({ value: valueOrText });
      });
      await this.page.waitForTimeout(1000);
      return;
    }

    // Angular Material mat-select or custom combobox
    await this.waitAndClick(el, 15000);
    this.log('Clicked dropdown, waiting for options overlay...', { target: valueOrText });

    // Wait for dropdown overlay / options to appear
    await this.page.waitForSelector('.cdk-overlay-pane, mat-option, [role="option"], .mat-mdc-option', { timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(500);

    const options = this.page.locator('mat-option, [role="option"], .mat-mdc-option');
    const count = await options.count();
    this.log(`Found ${count} dropdown options`, { target: valueOrText });

    const cleanTarget = valueOrText.toLowerCase().trim();
    let selected = false;

    // 1. Try exact or partial match
    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const text = ((await opt.textContent()) || '').toLowerCase().trim();
      if (text === cleanTarget || text.includes(cleanTarget) || cleanTarget.includes(text)) {
        this.log('Found matching option by full text', { text });
        await this.waitAndClick(opt, 5000);
        selected = true;
        break;
      }
    }

    // 2. Keyword fallback (e.g. if looking for "Greece Visa application center, Alexandria", match option containing "Alexandria")
    if (!selected) {
      const keywords = cleanTarget
        .split(/[\s,/-]+/)
        .filter((w) => w.length >= 4 && !['visa', 'center', 'centre', 'application', 'stay', 'short', 'long', 'greece'].includes(w));

      for (const kw of keywords) {
        for (let i = 0; i < count; i++) {
          const opt = options.nth(i);
          const text = ((await opt.textContent()) || '').toLowerCase();
          if (text.includes(kw)) {
            this.log('Found matching option by keyword', { kw, text });
            await this.waitAndClick(opt, 5000);
            selected = true;
            break;
          }
        }
        if (selected) break;
      }
    }

    // 3. Fallback to first available option if no match
    if (!selected && count > 0) {
      const firstOpt = options.first();
      const text = ((await firstOpt.textContent()) || '').trim();
      this.log('Falling back to first available option', { text });
      await this.waitAndClick(firstOpt, 5000);
    }

    // Give Angular time to react and load dependent options for the next dropdown
    await this.page.waitForTimeout(1500);
  }

  async selectRouteCriteria(criteria: VfsRouteSelectionCriteria): Promise<void> {
    this.log('Selecting appointment route details', { ...criteria });

    const centreSelect = this.page.locator(VFS_SELECTORS.appointmentDetails.centreSelect);
    const categorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.categorySelect);
    const subcategorySelect = this.page.locator(VFS_SELECTORS.appointmentDetails.subcategorySelect);

    try {
      // Ensure the first select is ready on page
      await centreSelect.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

      this.log('Step 1: Selecting Application Centre', { centre: criteria.centre });
      await this.selectDropdownOption(centreSelect, criteria.centre);

      this.log('Step 2: Selecting Visa Category', { category: criteria.category });
      await this.selectDropdownOption(categorySelect, criteria.category);

      this.log('Step 3: Selecting Visa Subcategory', { subcategory: criteria.subcategory });
      await this.selectDropdownOption(subcategorySelect, criteria.subcategory);

      const continueBtn = this.page.locator(VFS_SELECTORS.appointmentDetails.continueButton).first();
      if (await continueBtn.count() > 0 && await continueBtn.isVisible().catch(() => false)) {
        this.log('Clicking Continue on appointment details');
        await this.waitAndClick(continueBtn, 10000);
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForTimeout(2000);
      }
    } catch (err: any) {
      throw new VfsRouteNotSupportedError(
        `Failed to select route criteria (${criteria.centre} / ${criteria.category} / ${criteria.subcategory}): ${err.message}`,
      );
    }
  }
}
