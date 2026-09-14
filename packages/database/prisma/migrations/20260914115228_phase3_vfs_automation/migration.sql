-- CreateEnum
CREATE TYPE "AutomationSessionStatus" AS ENUM ('STARTING', 'ACTIVE', 'HUMAN_ACTION_REQUIRED', 'PAYMENT_HANDOFF', 'COMPLETED', 'LOST', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentHandoffStatus" AS ENUM ('REQUIRED', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "BookingCase" ADD COLUMN     "providerAccountId" TEXT;

-- CreateTable
CREATE TABLE "AutomationSession" (
    "id" TEXT NOT NULL,
    "bookingCaseId" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "providerCode" "ProviderCode" NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "AutomationSessionStatus" NOT NULL DEFAULT 'STARTING',
    "storageStateEncrypted" TEXT,
    "humanActionType" TEXT,
    "resumeToStatus" "BookingCaseStatus",
    "checkpointJson" JSONB,
    "currentPath" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHandoff" (
    "id" TEXT NOT NULL,
    "bookingCaseId" TEXT NOT NULL,
    "automationSessionId" TEXT,
    "status" "PaymentHandoffStatus" NOT NULL DEFAULT 'REQUIRED',
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "externalReference" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "safePaymentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationSession_bookingCaseId_idx" ON "AutomationSession"("bookingCaseId");

-- CreateIndex
CREATE INDEX "AutomationSession_workerId_idx" ON "AutomationSession"("workerId");

-- CreateIndex
CREATE INDEX "AutomationSession_status_idx" ON "AutomationSession"("status");

-- CreateIndex
CREATE INDEX "PaymentHandoff_bookingCaseId_idx" ON "PaymentHandoff"("bookingCaseId");

-- CreateIndex
CREATE INDEX "PaymentHandoff_automationSessionId_idx" ON "PaymentHandoff"("automationSessionId");

-- CreateIndex
CREATE INDEX "PaymentHandoff_status_idx" ON "PaymentHandoff"("status");

-- CreateIndex
CREATE INDEX "BookingCase_providerAccountId_idx" ON "BookingCase"("providerAccountId");

-- AddForeignKey
ALTER TABLE "BookingCase" ADD CONSTRAINT "BookingCase_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "ProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSession" ADD CONSTRAINT "AutomationSession_bookingCaseId_fkey" FOREIGN KEY ("bookingCaseId") REFERENCES "BookingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSession" ADD CONSTRAINT "AutomationSession_providerAccountId_fkey" FOREIGN KEY ("providerAccountId") REFERENCES "ProviderAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHandoff" ADD CONSTRAINT "PaymentHandoff_bookingCaseId_fkey" FOREIGN KEY ("bookingCaseId") REFERENCES "BookingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentHandoff" ADD CONSTRAINT "PaymentHandoff_automationSessionId_fkey" FOREIGN KEY ("automationSessionId") REFERENCES "AutomationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
