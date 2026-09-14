import type { Gender, ApplicantRelation } from '@visaflow/shared-types';

export interface ProviderApplicantInput {
  id: string;
  position: number;
  relation: ApplicantRelation;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  phone?: string | null;
  email?: string | null;
}
