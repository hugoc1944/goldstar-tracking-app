// scripts/seed-admin.ts
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash: hash,
      role: 'admin',
    },
  });

  console.log('Admin ready:', user.email);
  console.log('Password:', password);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });