import { prisma } from 'file:///d:/development/nexly/appointment bot/packages/database/dist/index.js';

async function main() {
  const caseId = 'cmu5hkwry00009f5gryra93yx';
  const c = await prisma.bookingCase.findUnique({
    where: { id: caseId },
    include: {
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      automationSessions: { orderBy: { createdAt: 'desc' }, take: 3 }
    }
  });

  console.log('Case status:', c?.status);
  console.log('Sessions:', c?.automationSessions?.map(s => ({ id: s.id, status: s.status, reason: s.failureReason, createdAt: s.createdAt })));
  console.log('Recent logs:');
  for (const log of c?.activityLogs || []) {
    console.log(`[${log.createdAt.toISOString()}] ${log.eventType}: ${log.message}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
