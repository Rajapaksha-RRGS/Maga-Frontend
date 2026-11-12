import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import prisma from '../src/config/prisma';

async function main() {
  const targetDateStr = process.argv[2] || '2026-07-16';
  const targetStatus = (process.argv[3] || 'submitted') as 'submitted' | 'draft';

  console.log(`\n======================================================`);
  console.log(` Reverting records for date: ${targetDateStr} to status: '${targetStatus}'`);
  console.log(`======================================================\n`);

  const startDate = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endDate = new Date(`${targetDateStr}T23:59:59.999Z`);

  // 1. Find all daily sheets for the target date
  const sheets = await prisma.mF_OP_DailySheet.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      supervisor: {
        select: {
          fullName: true,
          username: true,
        },
      },
      _count: {
        select: {
          timeEntries: true,
        },
      },
    },
  });

  if (sheets.length === 0) {
    console.log(`❌ No Daily Sheets found for ${targetDateStr}.`);
    return;
  }

  console.log(`Found ${sheets.length} Daily Sheet(s):`);
  sheets.forEach((s) => {
    console.log(
      ` - Supervisor: ${s.supervisor?.fullName || s.supervisor?.username} | Status: ${s.status} | Entries: ${s._count.timeEntries}`
    );
  });

  const sheetIds = sheets.map((s) => s.id);

  // 2. Update Daily Sheets
  const updatedSheets = await prisma.mF_OP_DailySheet.updateMany({
    where: {
      id: { in: sheetIds },
    },
    data: {
      status: targetStatus,
      isLocked: targetStatus === 'draft' ? false : true,
      approvedAt: null,
      approvedById: null,
    },
  });
  console.log(`\n✓ Updated ${updatedSheets.count} Daily Sheet(s) to '${targetStatus}'.`);

  // 3. Update Time Entries
  const updatedTimeEntries = await prisma.mF_OP_TimeEntry.updateMany({
    where: {
      dailySheetId: { in: sheetIds },
    },
    data: {
      status: targetStatus,
    },
  });
  console.log(`✓ Updated ${updatedTimeEntries.count} Time Entry record(s) to '${targetStatus}'.`);

  // 4. Update Equipment Logs if any
  const eqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
    where: { dailySheetId: { in: sheetIds } },
    select: { id: true },
  });

  if (eqAssignments.length > 0) {
    const updatedEqLogs = await prisma.mF_OP_EquipmentDailyLog.updateMany({
      where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
      data: { status: targetStatus },
    });
    console.log(`✓ Updated ${updatedEqLogs.count} Equipment Log(s) to '${targetStatus}'.`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS: 2026/07/16 records have been reverted to '${targetStatus}'!`);
  console.log(`Now they will appear in the 'Pending Approval' tab on /approvals.`);
  console.log(`======================================================\n`);
}

main()
  .catch((err) => {
    console.error('❌ Error executing revert script:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

