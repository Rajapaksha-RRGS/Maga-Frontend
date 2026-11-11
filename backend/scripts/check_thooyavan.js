const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const e = await prisma.mF_OP_TimeEntry.findFirst({
    where: {
      employee: {
        corporateEmployee: {
          employeeCode: 'X51011'
        }
      }
    },
    include: {
      employee: { include: { corporateEmployee: true, tradeGroup: true } },
      activitySplits: { include: { activityCode: true } }
    }
  });
  console.log(JSON.stringify(e, null, 2));
}

main().then(() => prisma.$disconnect());

