import { prisma, PaymentHandoffStatus, BookingCaseStatus, StateActorType } from '@visaflow/database';
import { workerLogger } from '../../observability/safe-logger.js';

export class PaymentExpiryJob {
  async runPaymentExpiryCheck(): Promise<{ expiredCount: number }> {
    const now = new Date();

    const expiredHandoffs = await prisma.paymentHandoff.findMany({
      where: {
        status: PaymentHandoffStatus.REQUIRED,
        deadlineAt: {
          lt: now,
        },
      },
      include: {
        bookingCase: true,
      },
    });

    let expiredCount = 0;

    for (const handoff of expiredHandoffs) {
      try {
        await prisma.paymentHandoff.update({
          where: { id: handoff.id },
          data: { status: PaymentHandoffStatus.EXPIRED },
        });

        // If the case is still in PAYMENT_REQUIRED, record notification
        if (handoff.bookingCase.status === BookingCaseStatus.PAYMENT_REQUIRED) {
          await prisma.notification.create({
            data: {
              bookingCaseId: handoff.bookingCaseId,
              type: 'PAYMENT_EXPIRED',
              title: 'Payment Window Expired',
              message: `Payment deadline passed for case ${handoff.bookingCase.caseNumber}. Manual intervention or case re-check required.`,
            },
          });
        }

        expiredCount++;
      } catch (err) {
        workerLogger.error(`Failed handling expired payment handoff ${handoff.id}:`, err);
      }
    }

    if (expiredCount > 0) {
      workerLogger.info(`Processed ${expiredCount} expired payment handoffs.`);
    }

    return { expiredCount };
  }
}
