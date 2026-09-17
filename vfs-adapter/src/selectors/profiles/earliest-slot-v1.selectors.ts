export const EARLIEST_SLOT_V1_SELECTORS = {
  availability: {
    heading: 'Appointment Availability',
    slotNotice: '.slot-notice, .availability-message, [data-testid="availability-notice"]',
    earliestSlotBadge: '.earliest-slot, [data-testid="earliest-slot"]',
    noSlotNotice: '.no-slot-notice',
    capacityBanner: '.capacity-alert, [data-testid="capacity-banner"]',
  },
  slotSelection: {
    slotItem: '.slot-item, [data-testid="slot-candidate"], input[type="radio"][name="slot"]',
    continueButton: 'button:has-text("Continue"), button:has-text("Proceed to Payment")',
  },
} as const;
