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

    const currentUrl = this.page.url();
    const isPastApplicantStep = currentUrl.includes('slot-selection') || currentUrl.includes('book-appointment') || currentUrl.includes('services') || currentUrl.includes('review') || currentUrl.includes('payment');
    if (isPastApplicantStep) {
      this.log('Already past applicant details step, skipping form entry.');
      return;
    }

    // Guard: if already on Your Details Summary, do not re-enter details
    const isAlreadySummary = await this.page.locator(
      'h1:has-text("Your Details Summary"), button:has-text("Add another applicant")'
    ).first().isVisible({ timeout: 1500 }).catch(() => false);

    if (isAlreadySummary) {
      this.log('Already on Your Details Summary screen, handling summary directly...');
      await this.handleSummaryPage(applicants.length);
      return;
    }

    // Check if form is present
    const hasForm = await this.page.locator(
      '#firstName, #mat-input-3, input[placeholder*="first name" i], input[formcontrolname="firstName"]'
    ).first().isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasForm) {
      this.log('Applicant details form inputs not found on current page, skipping form entry.');
      return;
    }

    for (let i = 0; i < applicants.length; i++) {
      const applicant = applicants[i]!;
      const mapped = mapToVfsApplicant(applicant);

      this.log(`Entering details for applicant position ${i + 1}`, { name: `${mapped.firstName} ${mapped.lastName}` });

      // 1. First & Last Name
      const fnLocator = this.page.locator('#mat-input-3, #firstName, input[name="firstName"], input[placeholder*="first name" i], input[formcontrolname="firstName"]').first();
      const lnLocator = this.page.locator('#mat-input-4, #lastName, input[name="lastName"], input[placeholder*="last name" i], input[formcontrolname="lastName"]').first();
      await this.waitAndFill(fnLocator, mapped.firstName);
      await this.waitAndFill(lnLocator, mapped.lastName);

      // 2. Gender (select or mat-select dropdown)
      const genderSelect = this.page.locator('#gender, #mat-select-3, mat-select[formcontrolname*="gender" i], select[name="gender"]').first();
      if (await genderSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const tagName = await genderSelect.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
        if (tagName === 'select') {
          await genderSelect.selectOption(mapped.gender).catch(() => {});
        } else {
          await genderSelect.click();
          await this.page.waitForTimeout(300);
          const genderLabel = mapped.gender.toUpperCase() === 'FEMALE' ? 'Female' : 'Male';
          const opt = this.page.locator(`mat-option:has-text("${genderLabel}"), mat-option:has-text("${mapped.gender}")`).first();
          if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
            await opt.click();
          }
        }
      }

      // 3. Date of Birth (#dateOfBirth)
      const dob = this.page.locator('#dateOfBirth, input[name="dateOfBirth"], input[formcontrolname*="dateOfBirth" i]').first();
      if (await dob.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dob.click().catch(() => {});
        await dob.fill(mapped.dateOfBirth);
        await dob.dispatchEvent('input');
        await dob.dispatchEvent('change');
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 4. Current Nationality (#nationality or #mat-select-4)
      const natSelect = this.page.locator('#nationality, #mat-select-4, mat-select[formcontrolname*="nationality" i], select[name="nationality"]').first();
      if (await natSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const tagName = await natSelect.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
        if (tagName === 'select') {
          await natSelect.selectOption(mapped.nationality).catch(() => {});
        } else if (tagName === 'input') {
          await natSelect.fill(mapped.nationality).catch(() => {});
          await natSelect.dispatchEvent('input').catch(() => {});
          await natSelect.dispatchEvent('change').catch(() => {});
        } else {
          await natSelect.click();
          await this.page.waitForTimeout(300);
          const egyptOpt = this.page.locator('mat-option:has-text("EGYPT"), mat-option:has-text("Egypt")').first();
          if (await egyptOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
            await egyptOpt.click();
          }
        }
      }

      // 5. Passport Number (#mat-input-5, #passportNumber)
      const pass = this.page.locator('#mat-input-5, #passportNumber, input[name="passportNumber"], input[placeholder="Enter passport number"], input[formcontrolname*="passportNumber" i]').first();
      if (await pass.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pass.fill(mapped.passportNumber);
        await pass.dispatchEvent('input');
        await pass.dispatchEvent('change');
      }

      // 6. Passport Expiry Date (#passportExpirtyDate, #passportExpiry)
      const passExp = this.page.locator('#passportExpirtyDate, #passportExpiryDate, #passportExpiry, input[name="passportExpiry"], input[formcontrolname*="passportExpir" i]').first();
      if (await passExp.isVisible({ timeout: 2000 }).catch(() => false)) {
        await passExp.click().catch(() => {});
        await passExp.fill(mapped.passportExpiry);
        await passExp.dispatchEvent('input');
        await passExp.dispatchEvent('change');
        await this.page.keyboard.press('Tab').catch(() => {});
      }

      // 7. Phone Country Code & Number
      const pCode = this.page.locator('#mat-input-6, input[placeholder="44"], input[formcontrolname*="phoneCode" i]').first();
      if (await pCode.isVisible({ timeout: 1500 }).catch(() => false)) {
        const cleanCode = (mapped.phoneCountryCode || '20').replace(/^\+/, '');
        await pCode.fill(cleanCode);
        await pCode.dispatchEvent('input');
        await pCode.dispatchEvent('change');
      }

      const pNum = this.page.locator('#mat-input-7, #contactNumber, input[name="contactNumber"], input[placeholder="012345648382"], input[formcontrolname*="contactNumber" i]').first();
      if (await pNum.isVisible({ timeout: 2000 }).catch(() => false)) {
        let cleanPhone = mapped.phoneNumber || mapped.contactNumber;
        if (cleanPhone.startsWith('+20')) cleanPhone = cleanPhone.slice(3);
        else if (cleanPhone.startsWith('20') && cleanPhone.length > 10) cleanPhone = cleanPhone.slice(2);
        await pNum.fill(cleanPhone);
        await pNum.dispatchEvent('input');
        await pNum.dispatchEvent('change');
      }

      // 8. Email (#mat-input-8, #email)
      const email = this.page.locator('#mat-input-8, #email, input[name="email"], input[placeholder="Enter Email Address"], input[type="email"]').first();
      if (await email.isVisible({ timeout: 2000 }).catch(() => false)) {
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

      // If multiple applicants, click Save to add next applicant
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

      // If form has a submit / Continue button (like in synthetic fixtures or legacy forms)
      const continueSubmit = this.page.locator('#continue-applicants, button[type="submit"]:has-text("Continue")').first();
      if (await continueSubmit.isVisible({ timeout: 1000 }).catch(() => false)) {
        await continueSubmit.click({ force: true }).catch(() => {});
        await this.page.waitForURL((url) => !url.pathname.endsWith('/applicants'), { timeout: 5000 }).catch(() => {});
      }

      // Check if "Your Details Summary" screen appeared and proceed
      const isSummary = await this.page.locator(
        'h1:has-text("Your Details Summary"), button:has-text("Add another applicant")'
      ).first().isVisible({ timeout: 1500 }).catch(() => false);

      if (isSummary) {
        await this.handleSummaryPage(applicants.length);
      }
    }
  }

  async handleSummaryPage(expectedCount: number = 1): Promise<void> {
    this.log('Handling Your Details Summary page', { expectedCount });

    // 1. Remove duplicate/excess applicants if present
    const getTrashButtons = () => this.page.locator('button.fa-trash-can, button .fa-trash-can, .fa-trash-can');
    let trashCount = await getTrashButtons().count();

    while (trashCount > expectedCount) {
      this.log(`Detected ${trashCount} applicants on summary but expected ${expectedCount}. Removing excess applicant...`);
      const lastTrash = getTrashButtons().last();
      await lastTrash.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(600);

      const confirmBtn = this.page.locator('button:has-text("Yes, Remove"), button:has-text("Remove")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(1000);
      }
      trashCount = await getTrashButtons().count();
    }

    // 2. Click Continue to advance to Step 3: Book Appointment (Calendar)
    this.log('Locating Continue button on Your Details Summary...');
    const summaryContinue = this.page.locator('button.btn-brand-orange:has-text("Continue"), button:has-text("Continue")').first();
    try {
      if (await summaryContinue.isVisible({ timeout: 3000 }).catch(() => false)) {
        this.log('Clicking Continue on Your Details Summary to advance to Book Appointment...');
        await summaryContinue.scrollIntoViewIfNeeded().catch(() => {});
        await summaryContinue.click({ force: true }).catch(() => {});
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Continue');
          if (btn) btn.click();
        }).catch(() => {});
        await this.page.waitForURL((url) => url.pathname.includes('book-appointment') || url.pathname.includes('slot-selection'), { timeout: 6000 }).catch(() => {});
        await this.page.waitForTimeout(1000);
      }
    } catch (err: any) {
      this.log('Continue button handling completed or timed out', { message: err.message });
    }
  }
}
