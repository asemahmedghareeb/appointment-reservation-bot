import { describe, it, expect } from 'vitest';
import { formatAgeSeconds, formatRelativeTime, formatDate } from '../lib/formatters/dates';

describe('Date & Age Formatting Utilities', () => {
  it('formats seconds into readable age strings', () => {
    expect(formatAgeSeconds(30)).toBe('30s');
    expect(formatAgeSeconds(90)).toBe('1m 30s');
    expect(formatAgeSeconds(3600)).toBe('1h 0m');
    expect(formatAgeSeconds(3725)).toBe('1h 2m');
  });

  it('formats relative elapsed time correctly', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 10000)).toBe('10s ago');
    expect(formatRelativeTime(now - 120000)).toBe('2m ago');
    expect(formatRelativeTime(now - 7200000)).toBe('2h ago');
  });

  it('formats dates consistently or returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    const d = new Date('2026-09-14T00:00:00Z');
    expect(formatDate(d)).toContain('2026');
  });
});
