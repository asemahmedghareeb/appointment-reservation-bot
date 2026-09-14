export interface ProviderRouteConfig {
  passportRules?: {
    minimumValidityDaysAfterPreferredTravelDate?: number;
    minimumValidityDaysFromToday?: number;
    requireExpiryAfterPreferredDateTo?: boolean;
  };

  groupRules?: {
    minimumApplicants?: number;
    maximumApplicants?: number;
    allowSplit?: boolean;
  };

  [key: string]: unknown;
}
