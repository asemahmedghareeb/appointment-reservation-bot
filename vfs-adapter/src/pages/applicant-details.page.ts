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

      this.log(`Entering details for applicant position ${i + 1}`);

      const fnLocator = this.page.locator(VFS_SELECTORS.applicantDetails.firstName).first();
      const lnLocator = this.page.locator(VFS_SELECTORS.applicantDetails.lastName).first();
      const dobLocator = this.page.locator(VFS_SELECTORS.applicantDetails.dateOfBirth).first();
      const natLocator = this.page.locator(VFS_SELECTORS.applicantDetails.nationality).first();
      const passNumLocator = this.page.locator(VFS_SELECTORS.applicantDetails.passportNumber).first();
      const passExpLocator = this.page.locator(VFS_SELECTORS.applicantDetails.passportExpiry).first();
      const phoneLocator = this.page.locator(VFS_SELECTORS.applicantDetails.contactNumber).first();
      const emailLocator = this.page.locator(VFS_SELECTORS.applicantDetails.email).first();

      await this.waitAndFill(fnLocator, mapped.firstName);
      await this.waitAndFill(lnLocator, mapped.lastName);

      const genderSelect = this.page.locator(VFS_SELECTORS.applicantDetails.genderSelect).first();
      if (await genderSelect.count() > 0) {
        await genderSelect.selectOption({ label: mapped.gender }).catch(async () => {
          await genderSelect.selectOption({ value: mapped.gender });
        });
      }

      await this.waitAndFill(dobLocator, mapped.dateOfBirth);
      if (await natLocator.count() > 0) {
        await this.waitAndFill(natLocator, mapped.nationality);
      }
      await this.waitAndFill(passNumLocator, mapped.passportNumber);
      await this.waitAndFill(passExpLocator, mapped.passportExpiry);

      if (mapped.contactNumber && await phoneLocator.count() > 0) {
        await this.waitAndFill(phoneLocator, mapped.contactNumber);
      }
      if (mapped.email && await emailLocator.count() > 0) {
        await this.waitAndFill(emailLocator, mapped.email);
      }

      // If there are multiple applicants, save applicant or click Add Applicant
      const saveBtn = this.page.locator(VFS_SELECTORS.applicantDetails.saveApplicantButton).first();
      if (await saveBtn.count() > 0 && i < applicants.length - 1) {
        await this.waitAndClick(saveBtn);
        await this.page.waitForTimeout(500); // Brief UI stabilization
      }
    }

    const continueBtn = this.page.locator(VFS_SELECTORS.applicantDetails.continueButton).first();
    await this.waitAndClick(continueBtn);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  }
}
