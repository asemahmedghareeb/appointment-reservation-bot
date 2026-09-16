import { PrismaClient, ProviderCode, BookingMode } from '@prisma/client';
import { randomBytes, createCipheriv } from 'node:crypto';
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

  const vfs = await prisma.provider.findUnique({ where: { code: ProviderCode.VFS } });
  if (vfs) {
    // Subcategories for Hungary Short Term Visa from live VFS portal
    const hunShortTermSubcategories = [
      'Tourism',
      'Business Visa',
      'Conference',
      'Medical Reasons',
      'Sports/cultural Events',
      'Study C Visa',
      'Visiting Family/friends',
    ];

    const standardShortTermSubcategories = [
      'Tourism',
      'Business Visa',
      'Visiting Family/friends',
    ];

    const routes: any[] = [];

    // 1. Hungary (HU) Routes
    for (const subcat of hunShortTermSubcategories) {
      routes.push({
        providerId: vfs.id,
        sourceCountry: 'EG',
        destinationCountry: 'HU',
        applicationCentre: 'Hungary Visa Application Centre, CAIRO C Visa (Short Term)',
        visaCategory: 'Short Term Visa',
        visaSubcategory: subcat,
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        enabled: true,
        configurationJson: {
          entryUrl: 'https://visa.vfsglobal.com/egy/en/hun/login',
          availabilityMode: 'CALENDAR',
          pageProfile: 'VFS_CALENDAR_V1',
          capabilities: {
            groupBooking: true,
            applicantLimit: 4,
            paymentRequired: true,
          },
        },
      });
    }

    // Also support Long Term Visa for Hungary
    for (const subcat of ['Study D Visa', 'Employment', 'Family Reunification']) {
      routes.push({
        providerId: vfs.id,
        sourceCountry: 'EG',
        destinationCountry: 'HU',
        applicationCentre: 'Hungary Visa Application Centre, CAIRO C Visa (Short Term)',
        visaCategory: 'Long Term Visa',
        visaSubcategory: subcat,
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        enabled: true,
        configurationJson: {
          entryUrl: 'https://visa.vfsglobal.com/egy/en/hun/login',
          availabilityMode: 'CALENDAR',
          pageProfile: 'VFS_CALENDAR_V1',
          capabilities: {
            groupBooking: true,
            applicantLimit: 4,
            paymentRequired: true,
          },
        },
      });
    }

    // 2. Greece (GR) Routes (Cairo and Alexandria - exact live VFS options)
    const grCentres = [
      'Greece Visa Application Centre, Cairo',
      'Greece Visa application center, Alexandria',
    ];

    const grShortStaySubcategories = [
      'Blue Attestation',
      'Business Visa',
      'Cultural / Sports Events',
      'Medical Treatment',
      'Study - short course',
      'Tourism Visa',
      'Visiting Friends / Familly',
    ];

    for (const centre of grCentres) {
      for (const subcat of grShortStaySubcategories) {
        routes.push({
          providerId: vfs.id,
          sourceCountry: 'EG',
          destinationCountry: 'GR',
          applicationCentre: centre,
          visaCategory: 'SHORT STAY',
          visaSubcategory: subcat,
          bookingMode: BookingMode.APPOINTMENT_CALENDAR,
          enabled: true,
          configurationJson: {
            entryUrl: 'https://visa.vfsglobal.com/egy/en/grc/login',
            availabilityMode: 'EARLIEST_SLOT',
            pageProfile: 'VFS_STANDARD_V1',
            capabilities: {
              groupBooking: true,
              applicantLimit: 4,
              paymentRequired: true,
            },
          },
        });
      }

      // 'Short Stay Visa' category with 'Seaman'
      routes.push({
        providerId: vfs.id,
        sourceCountry: 'EG',
        destinationCountry: 'GR',
        applicationCentre: centre,
        visaCategory: 'Short Stay Visa',
        visaSubcategory: 'Seaman',
        bookingMode: BookingMode.APPOINTMENT_CALENDAR,
        enabled: true,
        configurationJson: {
          entryUrl: 'https://visa.vfsglobal.com/egy/en/grc/login',
          availabilityMode: 'EARLIEST_SLOT',
          pageProfile: 'VFS_STANDARD_V1',
          capabilities: {
            groupBooking: true,
            applicantLimit: 4,
            paymentRequired: true,
          },
        },
      });
    }

    // 3. Austria (AT) Routes (Cairo and Alexandria)
    for (const centre of ['Austria Visa Application Center-Cairo', 'Austria Visa Application Center-Alexandria']) {
      for (const subcat of standardShortTermSubcategories) {
        routes.push({
          providerId: vfs.id,
          sourceCountry: 'EG',
          destinationCountry: 'AT',
          applicationCentre: centre,
          visaCategory: 'Short Term Visa',
          visaSubcategory: subcat,
          bookingMode: BookingMode.APPOINTMENT_CALENDAR,
          enabled: true,
          configurationJson: {
            entryUrl: 'https://visa.vfsglobal.com/egy/en/aut/login',
            availabilityMode: 'CALENDAR',
            pageProfile: 'VFS_CALENDAR_V1',
            capabilities: {
              groupBooking: true,
              applicantLimit: 3,
              paymentRequired: true,
            },
          },
        });
      }
    }

    // 4. Portugal (PT) Routes (Cairo and Alexandria - exact names from live VFS)
    for (const centre of ['Portugal Visa Application Center-Cairo', 'Portugal Visa Application Center-Alexandria']) {
      for (const subcat of standardShortTermSubcategories) {
        routes.push({
          providerId: vfs.id,
          sourceCountry: 'EG',
          destinationCountry: 'PT',
          applicationCentre: centre,
          visaCategory: 'Short Term Visa',
          visaSubcategory: subcat,
          bookingMode: BookingMode.APPOINTMENT_CALENDAR,
          enabled: true,
          configurationJson: {
            entryUrl: 'https://visa.vfsglobal.com/egy/en/prt/login',
            availabilityMode: 'EARLIEST_SLOT',
            pageProfile: 'VFS_EARLIEST_SLOT_V1',
            capabilities: {
              groupBooking: true,
              applicantLimit: 5,
              paymentRequired: true,
            },
          },
        });
      }
    }

    const activeRouteIds: string[] = [];

    for (const r of routes) {
      const existing = await prisma.providerRoute.findFirst({
        where: {
          providerId: r.providerId,
          sourceCountry: r.sourceCountry,
          destinationCountry: r.destinationCountry,
          applicationCentre: r.applicationCentre,
          visaCategory: r.visaCategory,
          visaSubcategory: r.visaSubcategory,
        },
      });

      if (!existing) {
        const created = await prisma.providerRoute.create({ data: r });
        activeRouteIds.push(created.id);
        console.log(`Seeded route: ${r.sourceCountry} → ${r.destinationCountry} (${r.applicationCentre} - ${r.visaSubcategory})`);
      } else {
        const updated = await prisma.providerRoute.update({
          where: { id: existing.id },
          data: {
            enabled: r.enabled,
            configurationJson: r.configurationJson,
          },
        });
        activeRouteIds.push(updated.id);
        console.log(`Updated route: ${r.sourceCountry} → ${r.destinationCountry} (${r.applicationCentre} - ${r.visaSubcategory})`);
      }
    }

    // Remap any existing booking cases referencing obsolete routes to an active official route
    const defaultAustriaRoute = await prisma.providerRoute.findFirst({
      where: { destinationCountry: 'AT', applicationCentre: 'Austria Visa Application Center-Cairo' },
    });
    if (defaultAustriaRoute) {
      await prisma.bookingCase.updateMany({
        where: {
          providerRoute: {
            destinationCountry: 'AT',
            id: { notIn: activeRouteIds },
          },
        },
        data: { providerRouteId: defaultAustriaRoute.id },
      });
    }

    // Delete obsolete / duplicate routes not in the active live VFS list
    const deleted = await prisma.providerRoute.deleteMany({
      where: {
        id: { notIn: activeRouteIds },
      },
    });
    console.log(`Cleaned up ${deleted.count} obsolete provider routes.`);

    // Seed VFS Provider Account
    const vfsEmail = process.env['VFS_ACCOUNT_EMAIL'] || 'asemelbadahy@gmail.com';
    const vfsPassword = process.env['VFS_ACCOUNT_PASSWORD'] || 'Cairo#2026!';
    const encKeyStr = process.env['DATA_ENCRYPTION_KEY'];
    if (encKeyStr) {
      const keyBuf = Buffer.from(encKeyStr, 'base64');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
      const ciphertext = Buffer.concat([cipher.update(vfsPassword, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const passwordEncrypted = ['v1', iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');

      const existingAccount = await prisma.providerAccount.findFirst({
        where: {
          providerId: vfs.id,
          email: vfsEmail,
        },
      });

      let accountId: string;
      if (!existingAccount) {
        const created = await prisma.providerAccount.create({
          data: {
            providerId: vfs.id,
            label: 'VFS Primary Account (Cairo)',
            email: vfsEmail,
            username: vfsEmail,
            passwordEncrypted,
            active: true,
          },
        });
        accountId = created.id;
        console.log(`Seeded VFS ProviderAccount: ${vfsEmail} (${created.id})`);
      } else {
        const updated = await prisma.providerAccount.update({
          where: { id: existingAccount.id },
          data: {
            passwordEncrypted,
            active: true,
          },
        });
        accountId = updated.id;
        console.log(`Updated VFS ProviderAccount: ${vfsEmail} (${updated.id})`);
      }

      // Link any existing VFS booking cases with null providerAccountId
      const linked = await prisma.bookingCase.updateMany({
        where: {
          providerAccountId: null,
          providerRoute: { providerId: vfs.id },
        },
        data: {
          providerAccountId: accountId,
        },
      });
      if (linked.count > 0) {
        console.log(`Linked ${linked.count} existing VFS booking case(s) to provider account ${accountId}`);
      }
    }
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
