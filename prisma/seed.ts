import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Clean existing data (order matters for FK constraints) ────────────────
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // ─── Admin User ───────────────────────────────────────────────────────────
  const adminPasswordHash = await argon2.hash('123456789');
  const admin = await prisma.user.create({
    data: {
      email: 'inacio@example.com',
      passwordHash: adminPasswordHash,
      name: 'Inácio Rodrigues',
      role: UserRole.ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`✅ Created Admin: ${admin.email}`);

  // ─── Manager User ─────────────────────────────────────────────────────────
  const managerPasswordHash = await argon2.hash('Manager@123456');
  const manager = await prisma.user.create({
    data: {
      email: 'manager@example.com',
      passwordHash: managerPasswordHash,
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`✅ Created Manager: ${manager.email}`);

  // ─── Regular Users ────────────────────────────────────────────────────────
  const regularPasswordHash = await argon2.hash('User@123456');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        passwordHash: regularPasswordHash,
        name: 'Alice Silva',
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        passwordHash: regularPasswordHash,
        name: 'Bob Santos',
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: false,
      },
    }),
  ]);
  users.forEach((u) => console.log(`✅ Created User: ${u.email}`));

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Seed credentials:');
  console.log('   Admin   → inacio@example.com    / 123456789');
  console.log('   Manager → manager@example.com  / Manager@123456');
  console.log('   User    → alice@example.com    / User@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
