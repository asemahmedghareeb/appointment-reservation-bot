import type { AvailabilityResult, SlotCandidate } from '@visaflow/provider-core';

export interface VfsCapacityBucket {
  minApplicants: number;
  maxApplicants: number;
  earliestDate: string; // YYYY-MM-DD
  time?: string;
  externalSlotId?: string;
  centre?: string;
}

export function parseAvailabilityBuckets(rawText: string): VfsCapacityBucket[] {
  const buckets: VfsCapacityBucket[] = [];
  // Match patterns like: "Earliest available slot for 1-2 applicants is 2026-11-16" or "1,2 applicants: 2026-11-16"
  const regex = /(?:for\s+)?(\d+)(?:\s*(?:-|to|,)\s*(\d+))?\s+applicants?\s*(?:is|:)?\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawText)) !== null) {
    const min = parseInt(match[1]!, 10);
    const max = match[2] ? parseInt(match[2], 10) : min;
    let dateStr = match[3]!;
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      dateStr = `${y}-${m}-${d}`;
    }

    buckets.push({
      minApplicants: min,
      maxApplicants: max,
      earliestDate: dateStr,
    });
  }

  return buckets;
}

export function matchAvailability(
  buckets: VfsCapacityBucket[],
  requestedApplicants: number,
  centre?: string,
): AvailabilityResult {
  if (buckets.length === 0) {
    return {
      kind: 'SUCCESS',
      data: { outcome: 'NO_SLOT' },
    };
  }

  // Find max capacity across all buckets
  const maxCapacity = Math.max(...buckets.map((b) => b.maxApplicants));
  if (requestedApplicants > maxCapacity) {
    return {
      kind: 'SUCCESS',
      data: {
        outcome: 'GROUP_CAPACITY_MISMATCH',
        requestedApplicants,
        maximumAvailableApplicants: maxCapacity,
      },
    };
  }

  // Find bucket that covers requestedApplicants
  const matching = buckets.find(
    (b) => requestedApplicants >= b.minApplicants && requestedApplicants <= b.maxApplicants,
  );

  if (!matching) {
    // If no specific bucket covers this range, but requestedApplicants <= maxCapacity
    const fallback = buckets.find((b) => b.maxApplicants >= requestedApplicants);
    if (fallback) {
      const resolvedCentre = centre ?? fallback.centre;
      const slot: SlotCandidate = {
        date: fallback.earliestDate,
        time: fallback.time ?? '09:00',
        capacity: fallback.maxApplicants,
        externalSlotId: fallback.externalSlotId ?? `slot_${fallback.earliestDate.replace(/-/g, '')}`,
        ...(resolvedCentre ? { centre: resolvedCentre } : {}),
      };
      return {
        kind: 'SUCCESS',
        data: {
          outcome: 'SLOT_FOUND',
          slot,
        },
      };
    }

    return {
      kind: 'SUCCESS',
      data: { outcome: 'NO_SLOT' },
    };
  }

  const resolvedCentre = centre ?? matching.centre;
  const slot: SlotCandidate = {
    date: matching.earliestDate,
    time: matching.time ?? '09:00',
    capacity: matching.maxApplicants,
    externalSlotId: matching.externalSlotId ?? `slot_${matching.earliestDate.replace(/-/g, '')}`,
    ...(resolvedCentre ? { centre: resolvedCentre } : {}),
  };

  return {
    kind: 'SUCCESS',
    data: {
      outcome: 'SLOT_FOUND',
      slot,
    },
  };
}
