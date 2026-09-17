-- CreateEnum
CREATE TYPE "AppointmentSelectionMode" AS ENUM ('ANY_AVAILABLE', 'DATE_RANGE', 'EXACT_DATE', 'EXACT_DATE_AND_TIME');

-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN "phoneCountryCode" TEXT,
ADD COLUMN "phoneNumber" TEXT;

-- AlterTable
ALTER TABLE "BookingCase" ADD COLUMN "appointmentSelectionMode" "AppointmentSelectionMode" NOT NULL DEFAULT 'ANY_AVAILABLE',
ADD COLUMN "preferredDate" TIMESTAMP(3),
ADD COLUMN "preferredTimeFrom" TEXT,
ADD COLUMN "preferredTimeTo" TEXT,
ADD COLUMN "acceptAnyAvailableTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "appointmentType" TEXT DEFAULT 'STANDARD',
ADD COLUMN "servicesJson" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN "providerTermsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN "providerServiceFee" DECIMAL(10,2),
ADD COLUMN "optionalServicesTotal" DECIMAL(10,2),
ADD COLUMN "additionalFees" DECIMAL(10,2),
ADD COLUMN "totalAmount" DECIMAL(10,2),
ADD COLUMN "currency" TEXT,
ADD COLUMN "feeCapturedAt" TIMESTAMP(3);
