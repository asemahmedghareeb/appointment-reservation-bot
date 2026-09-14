-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Applicant_clientId_idx" ON "Applicant"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingApplicant_bookingCaseId_position_key" ON "BookingApplicant"("bookingCaseId", "position");

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
