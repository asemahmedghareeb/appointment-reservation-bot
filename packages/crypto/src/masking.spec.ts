import { describe, it, expect } from 'vitest';
import { maskPassportNumber } from './masking.js';
import { NormalizationError } from './crypto.errors.js';

describe('Passport Masking Utility', () => {
  it('masks typical passport numbers correctly', () => {
    const masked8 = maskPassportNumber('A1234567');
    expect(masked8.startsWith('A12')).toBe(true);
    expect(masked8.endsWith('67')).toBe(true);
    expect(masked8).toContain('***');
    expect(masked8.length).toBe(8);

    const masked9 = maskPassportNumber('P98765432');
    expect(masked9.startsWith('P98')).toBe(true);
    expect(masked9.endsWith('32')).toBe(true);
    expect(masked9).toContain('****');
    expect(masked9.length).toBe(9);
  });

  it('masks short passport numbers safely', () => {
    expect(maskPassportNumber('ABCD')).toBe('A**D');
    expect(maskPassportNumber('AB')).toBe('**');
  });

  it('rejects empty or whitespace inputs', () => {
    expect(() => maskPassportNumber('')).toThrow(NormalizationError);
    expect(() => maskPassportNumber('   ')).toThrow(NormalizationError);
  });
});
