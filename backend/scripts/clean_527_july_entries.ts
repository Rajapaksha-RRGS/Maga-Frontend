/**
 * clean_527_july_entries.ts
 * 
 * Removes Time Entries, Equipment Splits, Daily Equipment Assignments,
 * Daily Gang Assignments, and Daily Sheets for:
 *   - Project: 527 (M00000527)
 *   - Supervisor: admin527
 *   - Date Range: 2026-07-03 to 2026-07-31 (inclusive)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import prisma from '../src/config/prisma';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const project = await prisma.mF_P_Project.findFirst({
    where: { OR: [{ subdomain: '527' }, { projectCode: 'M00000527' }] },
  });

  if (!project) {
    console.error('❌ Project 527 not found!');
    return;
  }

  const supervisor = await prisma.mF_P_User.findFirst({
    where: {
      projectId: project.id,
      username: 'admin527',
    },
  });

  if (!supervisor) {
    console.error('❌ Supervisor "admin527" not found in Project 527!');
    return;
  }

  const fromDate = new Date('2026-07-03T00:00:00.000Z');
  const toDate = new Date('2026-07-31T23:59:59.999Z');

  // 1. Find daily sheets created by admin527 for project 527 between July 3 and July 31
  const dailySheets = await prisma.mF_OP_DailySheet.findMany({
    where: {
      projectId: project.id,
      supervisorId: supervisor.id,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      supervisor: { select: { fullName: true, username: true } },
      _count: {
        select: {
          assignments: true,
          equipmentAssignments: true,
          timeEntries: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const dailySheetIds = dailySheets.map((s) => s.id);

  // 2. Find all time entries for these sheets or recorded by admin527 in this date range
  const timeEntries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      projectId: project.id,
      date: { gte: fromDate, lte: toDate },
      OR: [
        { dailySheetId: { in: dailySheetIds } },
        { recordedById: supervisor.id },
      ],
    },
    select: { id: true, date: true, employeeId: true, hours: true, shiftHours: true },
  });
  const timeEntryIds = timeEntries.map((t) => t.id);

  // 3. Find Equipment Splits
  const opSplitsCount = await prisma.mF_OP_OperatorEquipmentSplit.count({
    where: { timeEntryId: { in: timeEntryIds } },
  });

  // 4. Find Labor Activity Splits (if any)
  const actSplitsCount = await prisma.mF_OP_LaborActivitySplit.count({
    where: { timeEntryId: { in: timeEntryIds } },
  });

  // 5. Find Daily Equipment Assignments
  const eqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
    where: { dailySheetId: { in: dailySheetIds } },
    select: { id: true },
  });
  const eqAssignmentIds = eqAssignments.map((ea) => ea.id);

  // 6. Find Equipment Daily Logs
  const eqLogsCount = await prisma.mF_OP_EquipmentDailyLog.count({
    where: { assignmentId: { in: eqAssignmentIds } },
  });

  // 7. Find Daily Gang Assignments
  const gangAssignmentsCount = await prisma.mF_OP_DailyAssignment.count({
    where: { dailySheetId: { in: dailySheetIds } },
  });

  console.log(`\n======================================================`);
  console.log(`  CLEANUP TARGET: Project 527 (${project.projectName})`);
  console.log(`  Supervisor    : ${supervisor.fullName} (@${supervisor.username})`);
  console.log(`  Date Range    : 2026-07-03 to 2026-07-31`);
  console.log(`======================================================`);
  console.log(`Found Records:`);
  console.log(`  • Daily Sheets                 : ${dailySheets.length}`);
  dailySheets.forEach((s) => {
    console.log(`    - ${s.date.toISOString().split('T')[0]} | Status: ${s.status} | Entries: ${s._count.timeEntries} | Eq Assign: ${s._count.equipmentAssignments} | Gang: ${s._count.assignments}`);
  });
  console.log(`  • Operator Time Entries        : ${timeEntries.length}`);
  console.log(`  • Operator Equipment Splits    : ${opSplitsCount}`);
  console.log(`  • Labor Activity Splits        : ${actSplitsCount}`);
  console.log(`  • Equipment Daily Logs         : ${eqLogsCount}`);
  console.log(`  • Daily Equipment Assignments  : ${eqAssignmentIds.length}`);
  console.log(`  • Daily Gang Assignments       : ${gangAssignmentsCount}`);
  console.log(`======================================================`);

  if (isDryRun) {
    console.log(`\n🧪 [DRY RUN] No records were deleted. Run without --dry-run to permanently delete.\n`);
    return;
  }

  console.log(`\n🗑️ Executing permanent deletion...`);

  // Step A: Delete Operator Equipment Splits
  if (opSplitsCount > 0) {
    const delOpSplits = await prisma.mF_OP_OperatorEquipmentSplit.deleteMany({
      where: { timeEntryId: { in: timeEntryIds } },
    });
    console.log(`  ✓ Deleted ${delOpSplits.count} Operator Equipment Splits.`);
  }

  // Step B: Delete Labor Activity Splits
  if (actSplitsCount > 0) {
    const delActSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({
      where: { timeEntryId: { in: timeEntryIds } },
    });
    console.log(`  ✓ Deleted ${delActSplits.count} Labor Activity Splits.`);
  }

  // Step C: Delete Time Entries
  if (timeEntries.length > 0) {
    const delTimeEntries = await prisma.mF_OP_TimeEntry.deleteMany({
      where: { id: { in: timeEntryIds } },
    });
    console.log(`  ✓ Deleted ${delTimeEntries.count} Operator Time Entries.`);
  }

  // Step D: Delete Equipment Daily Logs
  if (eqLogsCount > 0) {
    const delEqLogs = await prisma.mF_OP_EquipmentDailyLog.deleteMany({
      where: { assignmentId: { in: eqAssignmentIds } },
    });
    console.log(`  ✓ Deleted ${delEqLogs.count} Equipment Daily Logs.`);
  }

  // Step E: Delete Daily Equipment Assignments
  if (eqAssignmentIds.length > 0) {
    const delEqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({
      where: { id: { in: eqAssignmentIds } },
    });
    console.log(`  ✓ Deleted ${delEqAssignments.count} Daily Equipment Assignments.`);
  }

  // Step F: Delete Daily Gang Assignments
  if (gangAssignmentsCount > 0) {
    const delGangAssignments = await prisma.mF_OP_DailyAssignment.deleteMany({
      where: { dailySheetId: { in: dailySheetIds } },
    });
    console.log(`  ✓ Deleted ${delGangAssignments.count} Daily Gang Assignments.`);
  }

  // Step G: Delete Daily Sheets
  if (dailySheetIds.length > 0) {
    const delSheets = await prisma.mF_OP_DailySheet.deleteMany({
      where: { id: { in: dailySheetIds } },
    });
    console.log(`  ✓ Deleted ${delSheets.count} Daily Sheets.`);
  }

  console.log(`\n🎉 Cleanup complete! Successfully deleted all records for Project 527 under supervisor @admin527 from 2026-07-03 to 2026-07-31.\n`);
}

main()
  .catch((err) => {
    console.error('❌ Error during cleanup:', err);
  })
  .finally(() => prisma.$disconnect());

