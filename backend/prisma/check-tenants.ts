import prisma from '../src/config/prisma';

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          employees: true,
          equipment: true,
        },
      },
    },
  });
  console.log('Current Tenants:');
  console.log(JSON.stringify(tenants, null, 2));

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      tenantId: true,
    },
  });
  console.log('Current Users:');
  console.log(JSON.stringify(users, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
