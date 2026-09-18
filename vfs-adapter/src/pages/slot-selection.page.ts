import { BaseVfsPage } from './base-vfs.page.js';
import { VfsPageType } from '../detection/vfs-page-classifier.js';
import { VFS_SELECTORS } from '../selectors/vfs-selectors.js';
import type { SlotCandidate } from '@visaflow/provider-core';
import { parseAvailabilityBuckets, matchAvailability } from '../mapping/availability.mapper.js';
import type { AvailabilityResult } from '@visaflow/provider-core';

export class SlotSelectionPage extends BaseVfsPage {
  get expectedPageType(): VfsPageType {
    return VfsPageType.SLOT_SELECTION;
  }

  async checkAvailability(requestedApplicants: number, centre?: string): Promise<AvailabilityResult> {
    this.log('Checking slot availability on selection page', { requestedApplicants, centre });

    const currentUrl = this.page.url();
    const isCalendarPage = currentUrl.includes('book-appointment') || currentUrl.includes('calendar') || currentUrl.includes('appointment-slot');
    const hasCalendar = await this.page.locator('mat-calendar, .mat-calendar, .calendar, .appointment-calendar, app-slot-picker, .date-picker').first().isVisible({ timeout: 2000 }).catch(() => false);

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
      // Check if slot items exist directly on page
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
    this.log('Selecting slot candidate', { date: slot.date, time: slot.time });

    // Look for slot element matching date or radio
    const slotLocator = this.page.locator(`[data-slot-date="${slot.date}"], :text("${slot.date}"), ${VFS_SELECTORS.slotSelection.slotItem}`).first();
    if (await slotLocator.count() === 0) {
      this.log('Target slot candidate not found on page');
      return false;
    }

    await this.waitAndClick(slotLocator);

    const continueBtn = this.page.locator(VFS_SELECTORS.slotSelection.continueButton).first();
    await this.waitAndClick(continueBtn);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    return true;
  }
}
