import prisma from '../src/config/prisma';

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: {
          users: true,
          employees: true,
          equipment: true,
          dailySheets: true,
          timeEntries: true,
        },
      },
    },
  });
  console.log('Current Unified Projects:');
  console.log(JSON.stringify(projects, null, 2));

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      projectId: true,
    },
  });
  console.log('Current Users:');
  console.log(JSON.stringify(users, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
