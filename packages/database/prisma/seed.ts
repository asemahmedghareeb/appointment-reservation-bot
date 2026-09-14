import { PrismaClient, ProviderCode } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';

// Load .env
loadDotenv();

const directUrl = process.env['DIRECT_URL'];

// PrismaClient configured explicitly for direct connection during administrative seed
const prisma = new PrismaClient({
  datasources: directUrl
    ? {
        db: {
          url: directUrl,
        },
      }
    : undefined,
});

async function main() {
  console.log('Running database seed via direct Supabase connection...');

  const providers = [
    {
      code: ProviderCode.VFS,
      name: 'VFS Global',
    },
    {
      code: ProviderCode.TLS,
      name: 'TLScontact',
    },
    {
      code: ProviderCode.BLS,
      name: 'BLS International',
    },
  ];

  for (const provider of providers) {
    const result = await prisma.provider.upsert({
      where: { code: provider.code },
      update: { name: provider.name, active: true },
      create: { code: provider.code, name: provider.name, active: true },
    });
    console.log(`Seeded provider [${result.code}]: ${result.name}`);
  }

  console.log('Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Database seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
