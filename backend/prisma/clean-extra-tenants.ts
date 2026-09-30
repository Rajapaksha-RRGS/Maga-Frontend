import prisma from '../src/config/prisma';

async function main() {
  console.log('🧹 Cleaning extra empty tenants...');

  const deleted = await prisma.tenant.deleteMany({
    where: {
      id: {
        not: '8da59027-a78d-494c-a964-d724eda3f657',
      },
    },
  });

  console.log(`Deleted ${deleted.count} extra tenants.`);

  const remainingTenants = await prisma.tenant.findMany({
    include: {
      users: {
        select: {
          username: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  console.log('Remaining Tenants in Database:');
  console.log(JSON.stringify(remainingTenants, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
