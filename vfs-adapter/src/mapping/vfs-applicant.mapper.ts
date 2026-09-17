import type { ProviderApplicantInput } from '@visaflow/provider-core';

export interface VfsFormattedApplicant {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string; // DD/MM/YYYY
  nationality: string;
  passportNumber: string;
  passportExpiry: string; // DD/MM/YYYY
  contactNumber: string;
  phoneCountryCode?: string | undefined;
  phoneNumber?: string | undefined;
  email: string;
}

export function formatVfsDate(dateStr: string): string {
  // Accepts YYYY-MM-DD or ISO string and outputs DD/MM/YYYY
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function mapToVfsApplicant(applicant: ProviderApplicantInput): VfsFormattedApplicant {
  return {
    firstName: applicant.firstName.trim(),
    lastName: applicant.lastName.trim(),
    gender: applicant.gender.toUpperCase(),
    dateOfBirth: formatVfsDate(applicant.dateOfBirth),
    nationality: applicant.nationality.trim().toUpperCase(),
    passportNumber: applicant.passportNumber.trim().toUpperCase(),
    passportExpiry: formatVfsDate(applicant.passportExpiry),
    contactNumber: applicant.phoneNumber?.trim() || applicant.phone?.trim() || '',
    phoneCountryCode: applicant.phoneCountryCode?.trim(),
    phoneNumber: applicant.phoneNumber?.trim(),
    email: applicant.email?.trim() ?? '',
  };
}
