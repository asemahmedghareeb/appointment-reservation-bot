-- CreateEnum
CREATE TYPE "BookingCaseStatus" AS ENUM ('DRAFT', 'READY', 'AUTHENTICATING', 'HUMAN_VERIFICATION_REQUIRED', 'MONITORING', 'WAITING_QUEUE', 'SLOT_FOUND', 'BOOKING', 'ADDING_APPLICANTS', 'APPOINTMENT_SELECTED', 'PAYMENT_REQUIRED', 'PAYMENT_PROCESSING', 'CONFIRMED', 'SLOT_LOST', 'EXPIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProviderCode" AS ENUM ('VFS', 'TLS', 'BLS');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('APPOINTMENT_CALENDAR', 'WAITING_QUEUE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BOOKING_AGENT', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "ApplicantRelation" AS ENUM ('PRIMARY', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "StateActorType" AS ENUM ('USER', 'WORKER', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "nationality" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passportNumberEncrypted" TEXT NOT NULL,
    "passportNumberHash" TEXT NOT NULL,
    "passportExpiry" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "code" "ProviderCode" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderRoute" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceCountry" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "applicationCentre" TEXT NOT NULL,
    "visaCategory" TEXT NOT NULL,
    "visaSubcategory" TEXT NOT NULL,
    "bookingMode" "BookingMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configurationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "providerRouteId" TEXT NOT NULL,
    "status" "BookingCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "bookingMode" "BookingMode" NOT NULL,
    "preferredDateFrom" TIMESTAMP(3),
    "preferredDateTo" TIMESTAMP(3),
    "preferredTime" TEXT,
    "allowGroupSplit" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingApplicant" (
    "id" TEXT NOT NULL,
    "bookingCaseId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "relation" "ApplicantRelation" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCaseStateHistory" (
    "id" TEXT NOT NULL,
    "bookingCaseId" TEXT NOT NULL,
    "fromStatus" "BookingCaseStatus",
    "toStatus" "BookingCaseStatus" NOT NULL,
    "reason" TEXT,
    "actorType" "StateActorType" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCaseStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAccount" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "passwordEncrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "bookingCaseId" TEXT,
    "actorType" "StateActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_passportNumberHash_key" ON "Applicant"("passportNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_code_key" ON "Provider"("code");

-- CreateIndex
CREATE INDEX "ProviderRoute_providerId_idx" ON "ProviderRoute"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingCase_caseNumber_key" ON "BookingCase"("caseNumber");

-- CreateIndex
CREATE INDEX "BookingCase_status_idx" ON "BookingCase"("status");

-- CreateIndex
CREATE INDEX "BookingCase_providerRouteId_idx" ON "BookingCase"("providerRouteId");

-- CreateIndex
CREATE INDEX "BookingCase_createdAt_idx" ON "BookingCase"("createdAt");

-- CreateIndex
CREATE INDEX "BookingApplicant_bookingCaseId_idx" ON "BookingApplicant"("bookingCaseId");

-- CreateIndex
CREATE INDEX "BookingApplicant_applicantId_idx" ON "BookingApplicant"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingApplicant_bookingCaseId_applicantId_key" ON "BookingApplicant"("bookingCaseId", "applicantId");

-- CreateIndex
CREATE INDEX "BookingCaseStateHistory_bookingCaseId_idx" ON "BookingCaseStateHistory"("bookingCaseId");

-- CreateIndex
CREATE INDEX "BookingCaseStateHistory_createdAt_idx" ON "BookingCaseStateHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAccount_providerId_idx" ON "ProviderAccount"("providerId");

-- CreateIndex
CREATE INDEX "ActivityLog_bookingCaseId_idx" ON "ActivityLog"("bookingCaseId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRoute" ADD CONSTRAINT "ProviderRoute_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCase" ADD CONSTRAINT "BookingCase_providerRouteId_fkey" FOREIGN KEY ("providerRouteId") REFERENCES "ProviderRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCase" ADD CONSTRAINT "BookingCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingApplicant" ADD CONSTRAINT "BookingApplicant_bookingCaseId_fkey" FOREIGN KEY ("bookingCaseId") REFERENCES "BookingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingApplicant" ADD CONSTRAINT "BookingApplicant_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCaseStateHistory" ADD CONSTRAINT "BookingCaseStateHistory_bookingCaseId_fkey" FOREIGN KEY ("bookingCaseId") REFERENCES "BookingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAccount" ADD CONSTRAINT "ProviderAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_bookingCaseId_fkey" FOREIGN KEY ("bookingCaseId") REFERENCES "BookingCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
