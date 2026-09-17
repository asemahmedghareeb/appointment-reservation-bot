import fs from 'fs';
import path from 'path';
import { prisma } from '../packages/database/dist/index.js';
import { encrypt } from '../packages/crypto/dist/index.js';

// Reads raw exported cookies from cookies.json and converts to Playwright storageState format
async function main() {
  const cookiesInputPath = path.resolve(process.cwd(), 'cookies.json');
  if (!fs.existsSync(cookiesInputPath)) {
    console.error('cookies.json not found! Please paste your exported cookies array into cookies.json');
    process.exit(1);
  }

  const raw = fs.readFileSync(cookiesInputPath, 'utf-8');
  const cookies = JSON.parse(raw);

  const storageState = {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
    })),
    origins: [
      {
        origin: 'https://visa.vfsglobal.com',
        localStorage: []
      }
    ]
  };

  const sessionFile = path.resolve(process.cwd(), '.vfs-session.json');
  fs.writeFileSync(sessionFile, JSON.stringify(storageState, null, 2), 'utf-8');
  console.log('Converted and saved to .vfs-session.json!');

  const account = await prisma.providerAccount.findFirst({ where: { active: true } });
  if (account) {
    await prisma.automationSession.updateMany({
      where: { providerAccountId: account.id },
      data: { storageStateEncrypted: encrypt(JSON.stringify(storageState)) }
    });
    console.log('Saved to Supabase database!');
  }
}

main().catch(console.error);
