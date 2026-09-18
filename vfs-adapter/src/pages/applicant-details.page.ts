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

      // 1. First & Last Name
      const fnLocator = this.page.locator('#mat-input-3, input[placeholder*="first name" i], input[formcontrolname="firstName"]').first();
      const lnLocator = this.page.locator('#mat-input-4, input[placeholder*="last name" i], input[formcontrolname="lastName"]').first();
      await this.waitAndFill(fnLocator, mapped.firstName);
      await this.waitAndFill(lnLocator, mapped.lastName);

      // 2. Gender (mat-select dropdown)
      const genderSelect = this.page.locator('#mat-select-3, mat-select[formcontrolname*="gender" i], mat-select:has-text("Select")').first();
      if (await genderSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await genderSelect.click();
        await this.page.waitForTimeout(400);
        const genderLabel = mapped.gender.toUpperCase() === 'FEMALE' ? 'Female' : 'Male';
        const opt = this.page.locator(`mat-option:has-text("${genderLabel}"), mat-option:has-text("${mapped.gender}")`).first();
        if (await opt.isVisible({ timeout: 2500 }).catch(() => false)) {
          await opt.click();
        }
      }

      // 3. Date of Birth (#dateOfBirth) - MUST NOT use generic placeholder selector to avoid collision with Passport Expiry
      const dob = this.page.locator('#dateOfBirth, input[formcontrolname*="dateOfBirth" i]').first();
      if (await dob.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dob.click().catch(() => {});
        await dob.fill(mapped.dateOfBirth);
        await dob.dispatchEvent('input');
        await dob.dispatchEvent('change');
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 4. Current Nationality (#mat-select-4)
      const natSelect = this.page.locator('#mat-select-4, mat-select[formcontrolname*="nationality" i]').first();
      if (await natSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await natSelect.click();
        await this.page.waitForTimeout(400);
        const egyptOpt = this.page.locator('mat-option:has-text("EGYPT"), mat-option:has-text("Egypt")').first();
        if (await egyptOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await egyptOpt.click();
        }
      }

      // 5. Passport Number (#mat-input-5)
      const pass = this.page.locator('#mat-input-5, input[placeholder="Enter passport number"], input[formcontrolname*="passportNumber" i]').first();
      if (await pass.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pass.fill(mapped.passportNumber);
        await pass.dispatchEvent('input');
        await pass.dispatchEvent('change');
      }

      // 6. Passport Expiry Date (#passportExpirtyDate - VFS has typo with 'rt')
      const passExp = this.page.locator('#passportExpirtyDate, #passportExpiryDate, input[formcontrolname*="passportExpir" i]').first();
      if (await passExp.isVisible({ timeout: 3000 }).catch(() => false)) {
        await passExp.click().catch(() => {});
        await passExp.fill(mapped.passportExpiry);
        await passExp.dispatchEvent('input');
        await passExp.dispatchEvent('change');
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 7. Phone Country Code (#mat-input-6) & Number (#mat-input-7)
      const pCode = this.page.locator('#mat-input-6, input[placeholder="44"], input[formcontrolname*="phoneCode" i]').first();
      if (await pCode.isVisible({ timeout: 2000 }).catch(() => false)) {
        const cleanCode = (mapped.phoneCountryCode || '20').replace(/^\+/, '');
        await pCode.fill(cleanCode);
        await pCode.dispatchEvent('input');
        await pCode.dispatchEvent('change');
      }

      const pNum = this.page.locator('#mat-input-7, input[placeholder="012345648382"], input[formcontrolname*="contactNumber" i]').first();
      if (await pNum.isVisible({ timeout: 3000 }).catch(() => false)) {
        let cleanPhone = mapped.phoneNumber || mapped.contactNumber;
        if (cleanPhone.startsWith('+20')) cleanPhone = cleanPhone.slice(3);
        else if (cleanPhone.startsWith('20') && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(2);
        await pNum.fill(cleanPhone);
        await pNum.dispatchEvent('input');
        await pNum.dispatchEvent('change');
      }

      // 8. Email (#mat-input-8)
      const email = this.page.locator('#mat-input-8, input[placeholder="Enter Email Address"], input[type="email"]').first();
      if (await email.isVisible({ timeout: 3000 }).catch(() => false)) {
        await email.fill(mapped.email);
        await email.dispatchEvent('input');
        await email.dispatchEvent('change');
      }

      // Direct DOM validation check & fallback assignment to guarantee values are in place
      await this.page.evaluate((data) => {
        const dobEl = document.querySelector('#dateOfBirth') as HTMLInputElement | null;
        if (dobEl && (!dobEl.value || dobEl.value !== data.dateOfBirth)) {
          dobEl.value = data.dateOfBirth;
          dobEl.dispatchEvent(new Event('input', { bubbles: true }));
          dobEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const expEl = (document.querySelector('#passportExpirtyDate') || document.querySelector('#passportExpiryDate')) as HTMLInputElement | null;
        if (expEl && (!expEl.value || expEl.value !== data.passportExpiry)) {
          expEl.value = data.passportExpiry;
          expEl.dispatchEvent(new Event('input', { bubbles: true }));
          expEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { dateOfBirth: mapped.dateOfBirth, passportExpiry: mapped.passportExpiry }).catch(() => {});

      await this.page.waitForTimeout(800);

      // If multiple applicants, click Save / Add Applicant
      const saveBtn = this.page.locator('button:has-text("Save"), button:has-text("Add Applicant")').first();
      if (i < applicants.length - 1 && (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        this.log('Saving applicant to add next applicant...');
        await this.waitAndClick(saveBtn);
        await this.page.waitForTimeout(1500);
      }
    }

    // 9. Click Save to submit the applicant details form
    this.log('Locating Save button to submit applicant details...');
    const saveBtnLocator = this.page.locator('button.btn-brand-orange:has-text("Save"), button:has-text("Save")').first();
    if (await saveBtnLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
      this.log('Scrolling Save button into view and clicking...');
      await saveBtnLocator.scrollIntoViewIfNeeded().catch(() => {});

      // Wait up to 3s for button to be ready
      for (let attempt = 0; attempt < 4; attempt++) {
        const isReady = await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Save');
          return btn && !btn.disabled && !btn.classList.contains('mat-button-disabled') && !btn.classList.contains('mat-mdc-button-disabled');
        }).catch(() => false);
        if (isReady) break;
        await this.page.waitForTimeout(700);
      }

      await saveBtnLocator.click({ force: true }).catch(() => {});
      await this.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Save');
        if (btn) btn.click();
      }).catch(() => {});

      // Wait up to 12s for "Your Details Summary" screen and click Continue to advance to calendar
      this.log('Waiting for Your Details Summary and Continue button...');
      const summaryContinue = this.page.locator('button:has-text("Continue"), button.btn-brand-orange:has-text("Continue")').first();
      try {
        await summaryContinue.waitFor({ state: 'visible', timeout: 12000 });
        this.log('Clicking Continue on Your Details Summary...');
        await summaryContinue.click({ force: true }).catch(() => {});
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Continue');
          if (btn) btn.click();
        }).catch(() => {});
        await this.page.waitForURL((url) => url.pathname.includes('book-appointment'), { timeout: 10000 }).catch(() => {});
        await this.page.waitForTimeout(2000);
      } catch (err: any) {
        this.log('Continue button wait completed or timed out', { message: err.message });
      }
    }
  }
}
