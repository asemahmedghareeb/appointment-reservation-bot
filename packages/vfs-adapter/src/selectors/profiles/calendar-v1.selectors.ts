export const CALENDAR_V1_SELECTORS = {
  calendarView: {
    container: '.vfs-calendar-container, [data-testid="calendar-view"], .calendar-table',
    activeDay: '.calendar-day:not(.disabled), [data-testid="available-day"], .day-available',
    dayCell: (dateStr: string) => `[data-date="${dateStr}"], td:has-text("${dateStr}")`,
    monthNextButton: 'button.calendar-next, button[aria-label="Next Month"], .next-month',
    monthPrevButton: 'button.calendar-prev, button[aria-label="Previous Month"], .prev-month',
    timeSlotChip: '.time-slot, [data-testid="time-slot"], .slot-time-pill',
    selectedDateNotice: '.selected-date-info, [data-testid="selected-date"]',
  },
} as const;
