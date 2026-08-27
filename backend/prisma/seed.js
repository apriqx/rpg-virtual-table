const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);

    const user = await prisma.user.create({
      data: {
        email: 'admin@rpgtable.com',
        username: 'admin',
        passwordHash,
        role: 'ADMIN',
      },
    });

    console.log('Admin user created:', user.email);
    console.log('Seed completed successfully');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seed();
