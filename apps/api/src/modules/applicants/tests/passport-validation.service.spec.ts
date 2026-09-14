import { describe, it, expect } from 'vitest';
import { PassportValidationService } from '../passport-validation.service.js';
import { InvalidPassportExpiryError } from '../errors/invalid-passport-expiry.error.js';
import { BookingMode, ProviderCode, type ProviderRoute } from '@visaflow/database';

describe('PassportValidationService', () => {
  const service = new PassportValidationService();

  const baseRoute: ProviderRoute = {
    id: 'route_1',
    providerId: 'provider_1',
    sourceCountry: 'EG',
    destinationCountry: 'IT',
    applicationCentre: 'Cairo',
    visaCategory: 'TOURISM',
    visaSubcategory: 'SHORT_STAY',
    bookingMode: BookingMode.APPOINTMENT_CALENDAR,
    enabled: true,
    configurationJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('Test A: does not invent any default rule when route has no passportRules configured', () => {
    const routeWithoutRules: ProviderRoute = {
      ...baseRoute,
      configurationJson: {},
    };

    // Even if passport expires tomorrow or earlier, if no rules exist, validation must not invent any 6-month rule
    const passportExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry,
        providerRoute: routeWithoutRules,
      }),
    ).not.toThrow();
  });

  it('Test B: passes when passport satisfies configured minimumValidityDaysFromToday', () => {
    const routeWithRule: ProviderRoute = {
      ...baseRoute,
      configurationJson: {
        passportRules: {
          minimumValidityDaysFromToday: 90,
        },
      },
    };

    // Passport valid for 180 days
    const validExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: validExpiry,
        providerRoute: routeWithRule,
      }),
    ).not.toThrow();
  });

  it('Test C: throws InvalidPassportExpiryError when passport fails configured minimumValidityDaysFromToday', () => {
    const routeWithRule: ProviderRoute = {
      ...baseRoute,
      configurationJson: {
        passportRules: {
          minimumValidityDaysFromToday: 90,
        },
      },
    };

    // Passport valid for only 30 days
    const invalidExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: invalidExpiry,
        providerRoute: routeWithRule,
      }),
    ).toThrow(InvalidPassportExpiryError);
  });

  it('Test D: route configuration drives behavior dynamically without code changes', () => {
    // 60 days validity passport
    const testExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Route 1 requires 45 days -> PASS
    const lenientRoute: ProviderRoute = {
      ...baseRoute,
      configurationJson: {
        passportRules: { minimumValidityDaysFromToday: 45 },
      },
    };
    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: testExpiry,
        providerRoute: lenientRoute,
      }),
    ).not.toThrow();

    // Route 2 requires 90 days -> REJECT
    const strictRoute: ProviderRoute = {
      ...baseRoute,
      configurationJson: {
        passportRules: { minimumValidityDaysFromToday: 90 },
      },
    };
    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: testExpiry,
        providerRoute: strictRoute,
      }),
    ).toThrow(InvalidPassportExpiryError);
  });

  it('validates requireExpiryAfterPreferredDateTo rule', () => {
    const route: ProviderRoute = {
      ...baseRoute,
      configurationJson: {
        passportRules: { requireExpiryAfterPreferredDateTo: true },
      },
    };

    const preferredDateTo = new Date('2026-12-31');
    const expiredBeforeDateTo = new Date('2026-12-01');
    const validAfterDateTo = new Date('2027-01-15');

    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: expiredBeforeDateTo,
        providerRoute: route,
        preferredDateTo,
      }),
    ).toThrow(InvalidPassportExpiryError);

    expect(() =>
      service.validateForRoute({
        applicantId: 'app_1',
        passportExpiry: validAfterDateTo,
        providerRoute: route,
        preferredDateTo,
      }),
    ).not.toThrow();
  });
});
