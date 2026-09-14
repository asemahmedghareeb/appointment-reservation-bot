import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicantsService } from '../applicants.service.js';
import { ApplicantsRepository } from '../applicants.repository.js';
import { ApplicantAlreadyExistsError } from '../errors/applicant-already-exists.error.js';
import { ApplicantLinkedToCasesError } from '../errors/applicant-linked-to-cases.error.js';
import {
  createPassportLookupHash,
  encrypt,
  decrypt,
} from '@visaflow/crypto';
import { Gender } from '@visaflow/shared-types';
import type { Applicant } from '@visaflow/database';

describe('ApplicantsService', () => {
  let service: ApplicantsService;
  let repo: Partial<ApplicantsRepository>;

  const mockApplicant: Applicant = {
    id: 'app_1',
    clientId: 'client_1',
    firstName: 'Tarek',
    lastName: 'Omar',
    gender: Gender.MALE as any,
    dateOfBirth: new Date('2000-01-01'),
    nationality: 'EG',
    phone: '+20100000000',
    email: 'tarek@example.com',
    passportNumberEncrypted: encrypt('A1234567'),
    passportNumberHash: createPassportLookupHash('A1234567'),
    passportExpiry: new Date('2030-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findByPassportHash: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(mockApplicant),
      create: vi.fn().mockImplementation((data) => ({
        id: 'app_created',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn().mockImplementation((id, data) => ({
        ...mockApplicant,
        ...data,
        id,
      })),
      delete: vi.fn().mockResolvedValue(mockApplicant),
      countLinkedCases: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([mockApplicant]),
      count: vi.fn().mockResolvedValue(1),
    };

    service = new ApplicantsService(repo as ApplicantsRepository);
  });

  it('Test A: normalizes, hashes, encrypts, and stores no plaintext passport', async () => {
    const res = await service.create({
      firstName: 'Tarek',
      lastName: 'Omar',
      gender: Gender.MALE,
      dateOfBirth: '2000-01-01',
      nationality: 'EG',
      passportNumber: ' a123 4567 ',
      passportExpiry: '2030-01-01',
    });

    const createCall = vi.mocked(repo.create)!.mock.calls[0]![0];
    // Plaintext passport number must NOT be in the data
    expect((createCall as Record<string, unknown>)['passportNumber']).toBeUndefined();

    // Must be hashed and encrypted using normalized value
    const normalizedExpected = 'A1234567';
    expect(createCall.passportNumberHash).toBe(createPassportLookupHash(normalizedExpected));
    expect(decrypt(createCall.passportNumberEncrypted)).toBe(normalizedExpected);

    // Response must conceal sensitive fields and provide masked passport
    expect(res.passportMasked).toBeDefined();
    expect((res as unknown as Record<string, unknown>)['passportNumberEncrypted']).toBeUndefined();
    expect((res as unknown as Record<string, unknown>)['passportNumberHash']).toBeUndefined();
  });

  it('Test B & C: detects duplicates across case/whitespace variations and throws ApplicantAlreadyExistsError', async () => {
    // When a hash already exists in repository
    vi.spyOn(repo as any, 'findByPassportHash').mockResolvedValue(mockApplicant);

    // Any variation must generate the same lookup hash and trigger duplicate rejection
    await expect(
      service.create({
        firstName: 'Tarek',
        lastName: 'Omar',
        gender: Gender.MALE,
        dateOfBirth: '2000-01-01',
        nationality: 'EG',
        passportNumber: 'a1234567',
        passportExpiry: '2030-01-01',
      }),
    ).rejects.toThrow(ApplicantAlreadyExistsError);

    await expect(
      service.create({
        firstName: 'Tarek',
        lastName: 'Omar',
        gender: Gender.MALE,
        dateOfBirth: '2000-01-01',
        nationality: 'EG',
        passportNumber: ' A123 4567 ',
        passportExpiry: '2030-01-01',
      }),
    ).rejects.toThrow(ApplicantAlreadyExistsError);
  });

  it('Test D: updating passport re-hashes and re-encrypts atomically', async () => {
    await service.update('app_1', { passportNumber: 'B9999999' });

    const updateCall = vi.mocked(repo.update)!.mock.calls[0]![1];
    expect(updateCall.passportNumberHash).toBe(createPassportLookupHash('B9999999'));
    expect(decrypt(updateCall.passportNumberEncrypted! as string)).toBe('B9999999');
  });

  it('Test E: response hides encrypted and hash fields', async () => {
    const res = await service.findById('app_1');

    expect(res.passportMasked).toContain('***');
    expect((res as unknown as Record<string, unknown>)['passportNumberEncrypted']).toBeUndefined();
    expect((res as unknown as Record<string, unknown>)['passportNumberHash']).toBeUndefined();
  });

  it('Test F: deleting linked applicant is rejected with ApplicantLinkedToCasesError', async () => {
    vi.spyOn(repo as any, 'countLinkedCases').mockResolvedValue(2);

    await expect(service.delete('app_1')).rejects.toThrow(ApplicantLinkedToCasesError);
  });
});
