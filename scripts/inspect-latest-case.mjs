import { prisma } from 'file:///d:/development/nexly/appointment bot/packages/database/dist/index.js';

async function main() {
  const c = await prisma.bookingCase.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      providerRoute: true,
      providerAccount: true,
      automationSessions: { orderBy: { createdAt: 'desc' }, take: 3 },
      stateHistory: { orderBy: { createdAt: 'desc' } },
      activityLogs: { take: 10, orderBy: { createdAt: 'desc' } }
    }
  });
  console.log('FULL CASE:', JSON.stringify(c, null, 2));

}

main().catch(console.error).finally(() => prisma.$disconnect());
