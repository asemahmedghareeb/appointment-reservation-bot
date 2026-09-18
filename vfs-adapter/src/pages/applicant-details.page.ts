import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { ProviderApplicantInput } from '@visaflow/provider-core';
import { mapToVfsApplicant } from '../mapping/vfs-applicant.mapper.js';

export class ApplicantDetailsPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.APPLICANT_DETAILS;
  }

  async addApplicants(applicants: ProviderApplicantInput[]): Promise<void> {
    this.log('Adding applicants to booking', { count: applicants.length });

    for (let i = 0; i < applicants.length; i++) {
      const applicant = applicants[i]!;
      const mapped = mapToVfsApplicant(applicant);

      this.log(`Entering details for applicant position ${i + 1}`, { name: `${mapped.firstName} ${mapped.lastName}` });

      const fnLocator = this.page.locator(VFS_SELECTORS.applicantDetails.firstName).first();
      const lnLocator = this.page.locator(VFS_SELECTORS.applicantDetails.lastName).first();
      const dobLocator = this.page.locator(VFS_SELECTORS.applicantDetails.dateOfBirth).first();
      const natLocator = this.page.locator(VFS_SELECTORS.applicantDetails.nationality).first();
      const passNumLocator = this.page.locator(VFS_SELECTORS.applicantDetails.passportNumber).first();
      const passExpLocator = this.page.locator(VFS_SELECTORS.applicantDetails.passportExpiry).first();
      const phoneLocator = this.page.locator(VFS_SELECTORS.applicantDetails.contactNumber).first();
      const emailLocator = this.page.locator(VFS_SELECTORS.applicantDetails.email).first();

      // 1. First & Last Name
      await this.waitAndFill(fnLocator, mapped.firstName);
      await this.waitAndFill(lnLocator, mapped.lastName);

      // 2. Gender (handles native select and Angular Material mat-select)
      const genderSelect = this.page.locator(VFS_SELECTORS.applicantDetails.genderSelect).first();
      if (await genderSelect.isVisible({ timeout: 4000 }).catch(() => false)) {
        const tagName = await genderSelect.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
        if (tagName === 'select') {
          await genderSelect.selectOption({ label: mapped.gender }).catch(async () => {
            await genderSelect.selectOption({ value: mapped.gender });
          });
        } else {
          await this.waitAndClick(genderSelect);
          await this.page.waitForTimeout(400);
          const genderLabel = mapped.gender.toUpperCase() === 'FEMALE' ? 'Female' : 'Male';
          const option = this.page
            .locator(`mat-option:has-text("${genderLabel}"), [role="option"]:has-text("${genderLabel}"), mat-option:has-text("${mapped.gender}")`)
            .first();
          if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.waitAndClick(option);
          }
        }
      }

      // 3. Date of Birth
      if (await dobLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
        await this.waitAndFill(dobLocator, mapped.dateOfBirth);
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 4. Nationality (if present)
      if (await natLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
        const natTagName = await natLocator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
        if (natTagName === 'select') {
          await natLocator.selectOption({ label: mapped.nationality }).catch(async () => {
            await natLocator.selectOption({ value: mapped.nationality });
          });
        } else if (natTagName === 'mat-select') {
          await this.waitAndClick(natLocator);
          await this.page.waitForTimeout(400);
          const natOption = this.page
            .locator(`mat-option:has-text("Egypt"), mat-option:has-text("${mapped.nationality}"), [role="option"]:has-text("Egypt")`)
            .first();
          if (await natOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.waitAndClick(natOption);
          }
        } else {
          await this.waitAndFill(natLocator, mapped.nationality);
        }
      }

      // 5. Passport Number & Expiry
      await this.waitAndFill(passNumLocator, mapped.passportNumber);
      if (await passExpLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
        await this.waitAndFill(passExpLocator, mapped.passportExpiry);
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 6. Phone Country Code & Number
      const phoneCodeLocator = this.page.locator(VFS_SELECTORS.applicantDetails.phoneCountryCode).first();
      if (mapped.phoneCountryCode && (await phoneCodeLocator.isVisible({ timeout: 2000 }).catch(() => false))) {
        const cleanCode = mapped.phoneCountryCode.replace(/^\+/, '');
        await this.waitAndFill(phoneCodeLocator, cleanCode).catch(() => {});
      }

      if (mapped.contactNumber && (await phoneLocator.isVisible({ timeout: 4000 }).catch(() => false))) {
        let cleanPhone = mapped.contactNumber;
        if (mapped.phoneCountryCode && cleanPhone.startsWith(mapped.phoneCountryCode)) {
          cleanPhone = cleanPhone.slice(mapped.phoneCountryCode.length);
        } else if (cleanPhone.startsWith('+20')) {
          cleanPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith('20') && cleanPhone.length > 10) {
          cleanPhone = cleanPhone.slice(2);
        }
        await this.waitAndFill(phoneLocator, cleanPhone);
      }

      // 7. Email
      if (mapped.email && (await emailLocator.isVisible({ timeout: 4000 }).catch(() => false))) {
        await this.waitAndFill(emailLocator, mapped.email);
      }

      await this.page.waitForTimeout(500);

      // If multiple applicants, click Save / Add Applicant
      const saveBtn = this.page.locator(VFS_SELECTORS.applicantDetails.saveApplicantButton).first();
      if (i < applicants.length - 1 && (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        this.log('Saving applicant to add next applicant...');
        await this.waitAndClick(saveBtn);
        await this.page.waitForTimeout(1500);
      }
    }

    // 8. Click Save or Continue to move to the Calendar step
    const submitBtn = this.page
      .locator('button:has-text("Save"), button:has-text("Continue"), button:has-text("Review Details"), button.mat-raised-button:has-text("Save"), button.mat-raised-button:has-text("Continue"), button[type="submit"]')
      .first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      this.log('Submitting applicant details form to advance to Calendar...');
      await this.waitAndClick(submitBtn, 10000);
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      await this.page.waitForTimeout(3000);

      // If a secondary Continue button appears (e.g. after applicant saved in list)
      const nextContinue = this.page.locator('button:has-text("Continue"):visible, a:has-text("Continue"):visible').first();
      if (await nextContinue.isVisible({ timeout: 4000 }).catch(() => false)) {
        this.log('Clicking second Continue to advance to appointment schedule...');
        await this.waitAndClick(nextContinue, 8000);
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForTimeout(2000);
      }
    }
  }
}
