import { describe, it, expect } from 'vitest';
import { parseAvailabilityBuckets, matchAvailability, type VfsCapacityBucket } from '../src/mapping/availability.mapper.js';

describe('VFS Availability Parsing and Matching', () => {
  it('parses capacity bucket strings', () => {
    const raw = 'Earliest available slot for 1-2 applicants is 2026-11-16. Earliest available slot for 3-4 applicants is 2026-11-17.';
    const buckets = parseAvailabilityBuckets(raw);

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toEqual({
      minApplicants: 1,
      maxApplicants: 2,
      earliestDate: '2026-11-16',
    });
    expect(buckets[1]).toEqual({
      minApplicants: 3,
      maxApplicants: 4,
      earliestDate: '2026-11-17',
    });
  });

  it('matches matching applicant count to correct bucket', () => {
    const buckets: VfsCapacityBucket[] = [
      { minApplicants: 1, maxApplicants: 2, earliestDate: '2026-11-16' },
      { minApplicants: 3, maxApplicants: 4, earliestDate: '2026-11-17' },
    ];

    const res2 = matchAvailability(buckets, 2, 'Cairo');
    expect(res2.kind).toBe('SUCCESS');
    if (res2.kind === 'SUCCESS' && res2.data.outcome === 'SLOT_FOUND') {
      expect(res2.data.slot.date).toBe('2026-11-16');
      expect(res2.data.slot.centre).toBe('Cairo');
    }

    const res4 = matchAvailability(buckets, 4, 'Cairo');
    expect(res4.kind).toBe('SUCCESS');
    if (res4.kind === 'SUCCESS' && res4.data.outcome === 'SLOT_FOUND') {
      expect(res4.data.slot.date).toBe('2026-11-17');
    }
  });

  it('returns GROUP_CAPACITY_MISMATCH when applicants exceed maximum available capacity', () => {
    const buckets: VfsCapacityBucket[] = [
      { minApplicants: 1, maxApplicants: 2, earliestDate: '2026-11-16' },
      { minApplicants: 3, maxApplicants: 4, earliestDate: '2026-11-17' },
    ];

    const res5 = matchAvailability(buckets, 5, 'Cairo');
    expect(res5.kind).toBe('SUCCESS');
    if (res5.kind === 'SUCCESS') {
      expect(res5.data.outcome).toBe('GROUP_CAPACITY_MISMATCH');
      if (res5.data.outcome === 'GROUP_CAPACITY_MISMATCH') {
        expect(res5.data.requestedApplicants).toBe(5);
        expect(res5.data.maximumAvailableApplicants).toBe(4);
      }
    }
  });

  it('returns NO_SLOT when bucket array is empty', () => {
    const res = matchAvailability([], 1, 'Cairo');
    expect(res.kind).toBe('SUCCESS');
    if (res.kind === 'SUCCESS') {
      expect(res.data.outcome).toBe('NO_SLOT');
    }
  });
});
