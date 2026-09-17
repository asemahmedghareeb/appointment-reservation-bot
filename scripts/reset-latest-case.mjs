import { prisma } from 'file:///d:/development/nexly/appointment bot/packages/database/dist/index.js';

async function resetCase() {
  const latestCase = await prisma.bookingCase.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!latestCase) {
    console.log('No booking cases found');
    return;
  }

  console.log(`Resetting case ${latestCase.id} (${latestCase.caseNumber}) from ${latestCase.status} to READY...`);

  const updated = await prisma.bookingCase.update({
    where: { id: latestCase.id },
    data: {
      status: 'READY',
    }
  });

  await prisma.automationSession.updateMany({
    where: {
      bookingCaseId: latestCase.id,
      status: { in: ['STARTING', 'ACTIVE', 'HUMAN_ACTION_REQUIRED', 'PAYMENT_HANDOFF'] },
    },
    data: {
      status: 'EXPIRED',
    }
  });

  await prisma.activityLog.create({
    data: {
      bookingCaseId: latestCase.id,
      actorType: 'USER',
      eventType: 'BOOKING_CASE_READY',
      message: `Booking case ${latestCase.caseNumber} manually reset to READY for retry`,
    }
  });

  console.log(`Successfully reset case to: ${updated.status}`);
}

resetCase().catch(console.error).finally(() => prisma.$disconnect());
