-- CreateIndex
CREATE INDEX "AutomationSession_status_expiresAt_idx" ON "AutomationSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingCase_status_updatedAt_idx" ON "BookingCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PaymentHandoff_status_deadlineAt_idx" ON "PaymentHandoff"("status", "deadlineAt");
