const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.mF_P_User.findMany({
    where: {
      OR: [
        { username: { contains: 'shanaka', mode: 'insensitive' } },
        { fullName: { contains: 'shanaka', mode: 'insensitive' } }
      ]
    }
  });

  const shanakaId = users[0].id;

  const entries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      recordedById: shanakaId
    },
    include: {
      employee: {
        include: {
          corporateEmployee: true,
          tradeGroup: true,
          businessPartner: true
        }
      },
      appliedBusinessPartner: true,
      activity: true,
      activitySplits: {
        include: {
          activityCode: true
        }
      },
      recordedBy: true
    },
    orderBy: [
      { date: 'asc' },
      { inTime: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`Total Shanaka entries: ${entries.length}`);
  const statusCounts = {};
  const dateCounts = {};
  for (const e of entries) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    const dStr = e.date.toISOString().split('T')[0];
    dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
  }
  console.log('Status counts:', statusCounts);
  console.log('Date counts:', dateCounts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
