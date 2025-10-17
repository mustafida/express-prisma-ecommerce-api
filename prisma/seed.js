// prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
  const ADMIN_USER  = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'admin123';
  const RESET_PASS  = (process.env.RESET_ADMIN_PASSWORD || 'false').toLowerCase() === 'true';

  // Cari user existing baik via email atau username
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USER }],
    },
  });

  if (existing) {
    const updates = {};
    if (existing.role !== 'admin') updates.role = 'admin';

    if (RESET_PASS) {
      updates.password = await bcrypt.hash(ADMIN_PASS, 10);
    }

    if (Object.keys(updates).length > 0) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: updates,
        select: { id: true, username: true, email: true, role: true },
      });
      console.log('✅ Admin updated:', updated);
    } else {
      console.log('✅ Admin already exists:', {
        id: existing.id, username: existing.username, email: existing.email, role: existing.role,
      });
    }
    return;
  }

  // Tidak ada → buat baru
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  const admin = await prisma.user.create({
    data: {
      username: ADMIN_USER,
      email: ADMIN_EMAIL,
      password: hash,
      role: 'admin',
    },
    select: { id: true, username: true, email: true, role: true },
  });
  console.log('🎉 Admin created:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
