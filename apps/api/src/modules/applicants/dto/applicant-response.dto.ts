import type { Gender } from '@visaflow/shared-types';

export class ApplicantResponseDto {
  id!: string;
  clientId!: string | null;
  firstName!: string;
  lastName!: string;
  gender!: Gender;
  dateOfBirth!: Date;
  nationality!: string;
  phone!: string | null;
  email!: string | null;
  passportMasked!: string;
  passportExpiry!: Date;
  createdAt!: Date;
  updatedAt!: Date;
}
