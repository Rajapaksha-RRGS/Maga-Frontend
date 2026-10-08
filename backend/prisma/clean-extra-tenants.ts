import prisma from '../src/config/prisma';

async function main() {
  console.log('🧹 Checking extra project sites...');

  const projects = await prisma.project.findMany({
    include: {
      users: {
        select: {
          username: true,
          fullName: true,
          role: true,
        },
      },
      _count: {
        select: {
          employees: true,
          equipment: true,
          dailySheets: true,
          timeEntries: true,
        },
      },
    },
  });

  console.log('Projects in Database:');
  console.log(JSON.stringify(projects, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
