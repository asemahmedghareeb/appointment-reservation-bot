import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

@Injectable()
export class CaseNumberService {
  /**
   * Generates a collision-resistant, non-sequential, human-readable case number.
   * Format: VF_<timestamp_base36>_<random_token>
   * Example: VF_LOX8P2_A7B9C3D
   */
  generate(): string {
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = randomBytes(4).toString('hex').toUpperCase();
    return `VF_${timestampPart}_${randomPart}`;
  }
}
