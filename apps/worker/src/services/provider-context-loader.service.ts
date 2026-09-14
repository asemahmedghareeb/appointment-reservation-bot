import { decrypt } from '@visaflow/crypto';
import type {
  ProviderContext,
  ProviderApplicantInput,
} from '@visaflow/provider-core';
import type { WorkerBookingCase, WorkerRepository } from '../repositories/worker.repository.js';
import { randomUUID } from 'node:crypto';

export class ProviderContextLoaderService {
  constructor(private readonly repo: WorkerRepository) {}

  async loadContextAndApplicants(
    caseId: string,
    correlationId?: string,
  ): Promise<{
    bookingCase: WorkerBookingCase;
    context: ProviderContext;
    applicants: ProviderApplicantInput[];
  }> {
    const bookingCase = await this.repo.findCaseById(caseId);
    if (!bookingCase) {
      throw new Error(`BookingCase not found: ${caseId}`);
    }

    const route = bookingCase.providerRoute;
    const providerCode = route.provider.code as any;

    const context: ProviderContext = {
      caseId: bookingCase.id,
      correlationId: correlationId ?? `corr_${randomUUID()}`,
      providerAccountId: bookingCase.providerAccountId ?? undefined,
      applicantCount: bookingCase.bookingApplicants.length,
      providerRoute: {
        id: route.id,
        providerCode,
        sourceCountry: route.sourceCountry,
        destinationCountry: route.destinationCountry,
        applicationCentre: route.applicationCentre,
        visaCategory: route.visaCategory,
        visaSubcategory: route.visaSubcategory,
        bookingMode: route.bookingMode as any,
        configuration: (route.configurationJson as Record<string, unknown>) || {},
      },
      casePreferences: {
        allowGroupSplit: bookingCase.allowGroupSplit,
        ...(bookingCase.preferredDateFrom ? { preferredDateFrom: bookingCase.preferredDateFrom.toISOString().slice(0, 10) } : {}),
        ...(bookingCase.preferredDateTo ? { preferredDateTo: bookingCase.preferredDateTo.toISOString().slice(0, 10) } : {}),
        ...(bookingCase.preferredTime ? { preferredTime: bookingCase.preferredTime } : {}),
      },
    };

    const applicants: ProviderApplicantInput[] = bookingCase.bookingApplicants.map((ba) => {
      const app = ba.applicant;
      let plaintextPassport: string;
      try {
        plaintextPassport = decrypt(app.passportNumberEncrypted);
      } catch {
        plaintextPassport = 'UNKNOWN';
      }

      return {
        id: app.id,
        position: ba.position,
        isPrimary: ba.isPrimary,
        relation: ba.relation as any,
        firstName: app.firstName,
        lastName: app.lastName,
        gender: app.gender as any,
        dateOfBirth: app.dateOfBirth.toISOString().slice(0, 10),
        nationality: app.nationality,
        passportNumber: plaintextPassport,
        passportExpiry: app.passportExpiry.toISOString().slice(0, 10),
        ...(app.phone ? { phone: app.phone } : {}),
        ...(app.email ? { email: app.email } : {}),
      };
    });


    return {
      bookingCase,
      context,
      applicants,
    };
  }
}
