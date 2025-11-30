// scripts/seed-admin.ts
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  // --- Admin 1 (existing) ---
  const primaryEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const primaryPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  // --- Admin 2 (new) – only if both env vars exist ---
  const secondaryEmail = process.env.ADMIN2_EMAIL;
  const secondaryPassword = process.env.ADMIN2_PASSWORD;

  const admins: { email: string; password: string }[] = [
    {
      email: primaryEmail.toLowerCase(),
      password: primaryPassword,
    },
  ];

  if (secondaryEmail && secondaryPassword) {
    admins.push({
      email: secondaryEmail.toLowerCase(),
      password: secondaryPassword,
    });
  }

  for (const admin of admins) {
    const hash = await bcrypt.hash(admin.password, 10);

    const user = await prisma.adminUser.upsert({
    where: { email: admin.email },
    update: {
      passwordHash: hash,   
      role: 'admin',
    },
    create: {
      email: admin.email,
      passwordHash: hash,
      role: 'admin',
    },
  });

    console.log('Admin ready:', user.email);
    console.log('Password:', admin.password);
    console.log('--------------------------');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
