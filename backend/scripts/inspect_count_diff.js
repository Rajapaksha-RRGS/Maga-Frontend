const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.mF_P_User.findMany({
    where: { username: { contains: 'shanaka', mode: 'insensitive' } }
  });
  const shanakaId = users[0].id;
  const entries = await prisma.mF_OP_TimeEntry.findMany({
    where: { recordedById: shanakaId },
    select: {
      id: true,
      date: true,
      status: true,
      inTime: true,
      outTime: true,
      hours: true,
      employee: {
        select: {
          callingName: true,
          corporateEmployee: { select: { employeeCode: true, fullName: true } }
        }
      }
    }
  });

  console.log('Total entries recorded by Shanaka in DB:', entries.length);
  const map = {};
  for (const e of entries) {
    const d = e.date.toISOString().split('T')[0];
    const key = `${d} | status: ${e.status}`;
    map[key] = (map[key] || 0) + 1;
  }
  console.log('Breakdown by Date & Status:', JSON.stringify(map, null, 2));

  const otherEntries = entries.filter(
    (e) => !(e.date.toISOString().startsWith('2026-07-16') && (e.status === 'submitted' || e.status === 'approved'))
  );
  console.log(`\nThe other ${otherEntries.length} entries that are NOT 2026-07-16 submitted:`);
  otherEntries.forEach((e) => {
    const d = e.date.toISOString().split('T')[0];
    const code = e.employee?.corporateEmployee?.employeeCode || 'N/A';
    const name = e.employee?.callingName || e.employee?.corporateEmployee?.fullName || 'N/A';
    console.log(`- Date: ${d} | Status: ${e.status} | Worker: ${name} (${code}) | In/Out: ${e.inTime}-${e.outTime}`);
  });
}

main().then(() => prisma.$disconnect());

