import { Injectable } from '@nestjs/common';
import type { ProviderRoute } from '@visaflow/database';
import type { ProviderRouteConfig } from '@visaflow/shared-types';
import { InvalidPassportExpiryError } from './errors/invalid-passport-expiry.error.js';

export interface ValidatePassportForRouteParams {
  applicantId: string;
  passportExpiry: Date;
  providerRoute: ProviderRoute;
  preferredDateFrom?: Date | null;
  preferredDateTo?: Date | null;
}

@Injectable()
export class PassportValidationService {
  validateForRoute(params: ValidatePassportForRouteParams): void {
    const {
      applicantId,
      passportExpiry,
      providerRoute,
      preferredDateFrom,
      preferredDateTo,
    } = params;

    const config = (providerRoute.configurationJson as ProviderRouteConfig | null) || {};
    const rules = config.passportRules;

    if (!rules) {
      // Do NOT invent default rules if none configured
      return;
    }

    const expiryTime = new Date(passportExpiry).getTime();

    // Rule 1: Expiry must be after preferredDateTo if required
    if (rules.requireExpiryAfterPreferredDateTo && preferredDateTo) {
      const travelEndTime = new Date(preferredDateTo).getTime();
      if (expiryTime <= travelEndTime) {
        throw new InvalidPassportExpiryError(
          applicantId,
          'requireExpiryAfterPreferredDateTo',
          `Passport expires on ${new Date(passportExpiry).toISOString().slice(0, 10)} which is not after the preferred travel end date ${new Date(preferredDateTo).toISOString().slice(0, 10)}.`,
        );
      }
    }

    // Rule 2: Minimum validity days from today
    if (rules.minimumValidityDaysFromToday && rules.minimumValidityDaysFromToday > 0) {
      const now = new Date();
      // Normalize to midnight UTC for day-level comparison
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const expiryUtc = Date.UTC(
        passportExpiry.getUTCFullYear(),
        passportExpiry.getUTCMonth(),
        passportExpiry.getUTCDate(),
      );

      const daysFromToday = Math.floor((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
      if (daysFromToday < rules.minimumValidityDaysFromToday) {
        throw new InvalidPassportExpiryError(
          applicantId,
          'minimumValidityDaysFromToday',
          `Passport validity (${daysFromToday} days from today) is less than the required minimum of ${rules.minimumValidityDaysFromToday} days.`,
        );
      }
    }

    // Rule 3: Minimum validity days after preferred travel date (use preferredDateTo if set, else preferredDateFrom)
    if (
      rules.minimumValidityDaysAfterPreferredTravelDate &&
      rules.minimumValidityDaysAfterPreferredTravelDate > 0
    ) {
      const referenceTravelDate = preferredDateTo || preferredDateFrom;
      if (referenceTravelDate) {
        const refUtc = Date.UTC(
          referenceTravelDate.getUTCFullYear(),
          referenceTravelDate.getUTCMonth(),
          referenceTravelDate.getUTCDate(),
        );
        const expiryUtc = Date.UTC(
          passportExpiry.getUTCFullYear(),
          passportExpiry.getUTCMonth(),
          passportExpiry.getUTCDate(),
        );

        const daysAfterTravel = Math.floor((expiryUtc - refUtc) / (1000 * 60 * 60 * 24));
        if (daysAfterTravel < rules.minimumValidityDaysAfterPreferredTravelDate) {
          throw new InvalidPassportExpiryError(
            applicantId,
            'minimumValidityDaysAfterPreferredTravelDate',
            `Passport validity after travel date (${daysAfterTravel} days) is less than the required minimum of ${rules.minimumValidityDaysAfterPreferredTravelDate} days.`,
          );
        }
      }
    }
  }
}
