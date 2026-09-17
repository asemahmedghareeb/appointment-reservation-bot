import { describe, it, expect } from 'vitest';
import { formatVfsDate, mapToVfsApplicant } from '../src/mapping/vfs-applicant.mapper.js';
import type { ProviderApplicantInput } from '@visaflow/provider-core';

describe('VFS Applicant Mapper', () => {
  it('formats dates into DD/MM/YYYY', () => {
    expect(formatVfsDate('1990-05-14')).toBe('14/05/1990');
    expect(formatVfsDate('2028-11-20T00:00:00.000Z')).toBe('20/11/2028');
  });

  it('transforms internal applicant into uppercase and formatted VFS values', () => {
    const applicant: ProviderApplicantInput = {
      position: 1,
      isPrimary: true,
      relation: 'PRIMARY',
      firstName: 'Ahmed',
      lastName: 'Hassan',
      gender: 'MALE',
      dateOfBirth: '1985-03-22',
      nationality: 'EGY',
      passportNumber: 'A12345678',
      passportExpiry: '2030-08-15',
      phone: '+201001234567',
      email: 'ahmed@example.com',
    };

    const mapped = mapToVfsApplicant(applicant);
    expect(mapped.firstName).toBe('AHMED');
    expect(mapped.lastName).toBe('HASSAN');
    expect(mapped.gender).toBe('MALE');
    expect(mapped.dateOfBirth).toBe('22/03/1985');
    expect(mapped.nationality).toBe('EGY');
    expect(mapped.passportNumber).toBe('A12345678');
    expect(mapped.passportExpiry).toBe('15/08/2030');
    expect(mapped.contactNumber).toBe('+201001234567');
    expect(mapped.email).toBe('ahmed@example.com');
  });
});
