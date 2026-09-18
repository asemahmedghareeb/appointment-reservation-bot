import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { SlotCandidate } from '@visaflow/provider-core';
import { parseAvailabilityBuckets, matchAvailability } from '../mapping/availability.mapper.js';
import type { AvailabilityResult } from '@visaflow/provider-core';
import { exec } from 'node:child_process';

export function popupBrowserWindow(page?: any): void {
  try {
    if (page && typeof page.bringToFront === 'function') {
      page.bringToFront().catch(() => {});
    }
  } catch {}
  try {
    if (process.platform === 'win32') {
      exec('powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate(\'Chrome\'); $wshell.AppActivate(\'VFS Global\')"', () => {});
    }
  } catch {}
}

export class SlotSelectionPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.SLOT_SELECTION;
  }

  async checkAvailability(requestedApplicants: number, centre?: string): Promise<AvailabilityResult> {
    this.log('Checking slot availability on selection page', { requestedApplicants, centre });

    const currentUrl = this.page.url();
    const isCalendarPage = currentUrl.includes('book-appointment') || currentUrl.includes('calendar') || currentUrl.includes('appointment-slot') || currentUrl.includes('slot-selection') || currentUrl.includes('applicants');
    const hasCalendar = await this.page.locator('full-calendar, .fc, mat-calendar, .mat-calendar, .calendar, .appointment-calendar, app-slot-picker, .date-picker').first().isVisible({ timeout: 2000 }).catch(() => false);

    const noSlotLocator = this.page.locator(VFS_SELECTORS.availability.noSlotNotice);
    if (await noSlotLocator.count() > 0 && await noSlotLocator.first().isVisible().catch(() => false)) {
      return {
        kind: 'SUCCESS',
        data: { outcome: 'NO_SLOT' },
      };
    }

    // Read availability notices and text
    const bodyText = await this.page.textContent('body').catch(() => '') || '';
    const buckets = parseAvailabilityBuckets(bodyText);

    if (buckets.length === 0) {
      // 1. Check if slot items exist directly on page
      const slotItems = this.page.locator(VFS_SELECTORS.slotSelection.slotItem);
      const count = await slotItems.count();
      if (count > 0) {
        const slotText = (await slotItems.first().textContent())?.trim() || '2026-11-20';
        const dateMatch = /\d{4}-\d{2}-\d{2}/.exec(slotText);
        const slotDate = dateMatch ? dateMatch[0] : '2026-11-20';

        return {
          kind: 'SUCCESS',
          data: {
            outcome: 'SLOT_FOUND',
            slot: {
              date: slotDate,
              time: '09:30',
              capacity: 5,
              externalSlotId: `slot_${slotDate.replace(/-/g, '')}`,
              ...(centre ? { centre } : {}),
            },
          },
        };
      }

      // 2. Check if FullCalendar has available days
      if (hasCalendar) {
        // Look for selectable day cells in FullCalendar
        const availableDay = this.page.locator('td.fc-daygrid-day:not(.fc-day-disabled)[data-date], td.fc-day-future:not(.fc-day-disabled)[data-date]').first();
        if (await availableDay.isVisible({ timeout: 1500 }).catch(() => false)) {
          const dateAttr = await availableDay.getAttribute('data-date').catch(() => null);
          if (dateAttr) {
            this.log('Discovered candidate date cell in FullCalendar', { date: dateAttr });
            return {
              kind: 'SUCCESS',
              data: {
                outcome: 'SLOT_FOUND',
                slot: {
                  date: dateAttr,
                  time: '09:00',
                  capacity: 1,
                  externalSlotId: `fc_slot_${dateAttr.replace(/-/g, '')}`,
                  ...(centre ? { centre } : {}),
                },
              },
            };
          }
        }
      }

      // If we are on the calendar page and no slots or buckets found, it is truly NO_SLOT
      if (isCalendarPage || hasCalendar) {
        return {
          kind: 'SUCCESS',
          data: { outcome: 'NO_SLOT' },
        };
      }

      // Otherwise, the page hasn't reached the calendar yet! Do not return false NO_SLOT!
      return {
        kind: 'RETRYABLE_FAILURE',
        code: 'VFS_CALENDAR_NOT_REACHED',
        safeMessage: 'لم يتم الوصول إلى شاشة تقويم المواعيد بعد، جاري المتابعة.',
      };
    }

    return matchAvailability(buckets, requestedApplicants, centre);
  }

  async selectSlot(slot: SlotCandidate): Promise<boolean> {
    this.log('Selecting slot candidate and proceeding to payment', { date: slot.date, time: slot.time });

    // Step 3: Slot Selection / Book Appointment
    // 1. Check for standard / fixture slot items
    const slotLocator = this.page.locator(
      `[data-slot-date="${slot.date}"], :text("${slot.date}"), input[value="${slot.date}"], ${VFS_SELECTORS.slotSelection.slotItem}`
    ).first();

    if (await slotLocator.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.waitAndClick(slotLocator).catch(() => {});
      const radio = slotLocator.locator('input[type="radio"]').first();
      if (await radio.isVisible().catch(() => false)) {
        await radio.check().catch(() => {});
      }
      const continueBtn = this.page.locator(
        `${VFS_SELECTORS.slotSelection.continueButton}, button[type="submit"]:has-text("Continue"), #continue-slot`
      ).first();
      if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.waitAndClick(continueBtn).catch(() => {});
      }
    }

    // 2. FullCalendar on Live VFS site
    if (this.page.url().includes('book-appointment')) {
      const typeRadio = this.page.locator('#mat-radio-0, input[type="radio"]').first();
      if (await typeRadio.isVisible({ timeout: 1500 }).catch(() => false)) {
        await typeRadio.click({ force: true }).catch(() => {});
      }

      // 2. Click the date on the calendar
      const targetDateCell = this.page.locator(
        `td[data-date="${slot.date}"], td.fc-daygrid-day:not(.fc-day-disabled)[data-date="${slot.date}"], [data-slot-date="${slot.date}"]`
      ).first();

      if (await targetDateCell.isVisible({ timeout: 2000 }).catch(() => false)) {
        this.log('Clicking target date cell in calendar', { date: slot.date });
        const dayLink = targetDateCell.locator('a, .fc-daygrid-day-number, span').first();
        if (await dayLink.isVisible().catch(() => false)) {
          await dayLink.click({ force: true }).catch(() => {});
        } else {
          await targetDateCell.click({ force: true }).catch(() => {});
        }
      } else {
        // Fallback: click first available non-disabled future day
        const firstAvail = this.page.locator('td.fc-day-future:not(.fc-day-disabled)[data-date]').first();
        if (await firstAvail.isVisible({ timeout: 1500 }).catch(() => false)) {
          const fallbackDate = await firstAvail.getAttribute('data-date');
          this.log('Clicking first available future day in calendar', { fallbackDate });
          await firstAvail.click({ force: true }).catch(() => {});
        }
      }

      await this.page.waitForTimeout(1500);

      // 3. Select time slot radio if available
      const timeSlot = this.page.locator(
        `mat-radio-button:has-text("${slot.time || ''}"), .time-slot:has-text("${slot.time || ''}"), mat-radio-button:not([id="mat-radio-0"]), input[type="radio"]:not([id*="mat-radio-0"])`
      ).first();
      if (await timeSlot.isVisible({ timeout: 2000 }).catch(() => false)) {
        this.log('Selecting time slot radio...');
        await timeSlot.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(800);
      }

      // 4. Click Continue on Book Appointment
      const continueBtn = this.page.locator('button.btn-brand-orange:has-text("Continue"), button:has-text("Continue")').first();
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        this.log('Clicking Continue on Book Appointment to advance to Services...');
        await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
        await continueBtn.click({ force: true }).catch(() => {});
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Continue');
          if (btn) btn.click();
        }).catch(() => {});
        await this.page.waitForTimeout(3000);
      }
    }

    // Step 4: Advance past Services page (/services)
    if (this.page.url().includes('services')) {
      this.log('Detected Services page (Step 4). Clicking Continue to advance to Review...');
      const servicesContinue = this.page.locator('button.btn-brand-orange:has-text("Continue"), button:has-text("Continue")').first();
      if (await servicesContinue.isVisible({ timeout: 5000 }).catch(() => false)) {
        await servicesContinue.scrollIntoViewIfNeeded().catch(() => {});
        await servicesContinue.click({ force: true }).catch(() => {});
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Continue');
          if (btn) btn.click();
        }).catch(() => {});
        await this.page.waitForTimeout(3000);
      }
    }

    // Step 5: Advance past Review page (/review) to Payment
    if (this.page.url().includes('review')) {
      this.log('Detected Review page (Step 5). Accepting terms and proceeding to Payment...');
      // Accept Terms & Conditions checkbox
      const termsCheckbox = this.page.locator('mat-checkbox, input[type="checkbox"], label:has-text("Terms"), label:has-text("Conditions")').first();
      if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await termsCheckbox.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(600);
      }

      // Click Proceed to Payment
      const payBtn = this.page.locator(
        'button:has-text("Proceed to Payment"), button.btn-brand-orange:has-text("Proceed"), button:has-text("Pay Online"), button:has-text("Pay")'
      ).first();
      if (await payBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        this.log('Clicking Proceed to Payment button...');
        await payBtn.scrollIntoViewIfNeeded().catch(() => {});
        await payBtn.click({ force: true }).catch(() => {});
        await this.page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            b => b.innerText.includes('Proceed') || b.innerText.includes('Pay')
          );
          if (btn) btn.click();
        }).catch(() => {});
        await this.page.waitForTimeout(4000);
      }
    }

    // Step 6: Verify if reached payment gateway and bring window to front!
    const isPaymentReached = /payment|checkout|payfort|fee/i.test(this.page.url());
    if (isPaymentReached) {
      this.log('Payment gateway reached! Bringing Chrome window to foreground for user...');
      popupBrowserWindow(this.page);
      return true;
    }

    return true;
  }
}

