/**
 * clean_521_july_ranges.ts
 * 
 * Removes Time Entries, Activity Splits, Daily Assignments, and Daily Sheets
 * for Project 521 (M00000521) for:
 *   - Range 1: 2026-07-04 to 2026-07-16 (inclusive)
 *   - Range 2: 2026-07-21 to 2026-07-31 (inclusive)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import prisma from '../src/config/prisma';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const project = await prisma.mF_P_Project.findFirst({
    where: { subdomain: '521' },
  });

  if (!project) {
    console.error('Project 521 not found!');
    return;
  }

  // Define date ranges: 2026-07-04 to 2026-07-16 and 2026-07-21 to 2026-07-31
  const dateFilters = [
    {
      gte: new Date('2026-07-04T00:00:00.000Z'),
      lte: new Date('2026-07-16T23:59:59.999Z'),
    },
    {
      gte: new Date('2026-07-21T00:00:00.000Z'),
      lte: new Date('2026-07-31T23:59:59.999Z'),
    },
  ];

  // Find daily sheets in these date ranges for Project 521
  const dailySheets = await prisma.mF_OP_DailySheet.findMany({
    where: {
      projectId: project.id,
      OR: dateFilters.map((range) => ({
        date: {
          gte: range.gte,
          lte: range.lte,
        },
      })),
    },
    include: {
      supervisor: {
        select: { fullName: true, username: true },
      },
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

  // Time entries for these dates
  const timeEntries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      projectId: project.id,
      OR: dateFilters.map((range) => ({
        date: {
          gte: range.gte,
          lte: range.lte,
        },
      })),
    },
    select: { id: true },
  });
  const timeEntryIds = timeEntries.map((t) => t.id);

  // Splits count
  const splitsCount = await prisma.mF_OP_LaborActivitySplit.count({
    where: {
      timeEntryId: { in: timeEntryIds },
    },
  });

  // Assignments count
  const assignmentsCount = await prisma.mF_OP_DailyAssignment.count({
    where: {
      dailySheetId: { in: dailySheetIds },
    },
  });

  console.log(`\n======================================================`);
  console.log(`  CLEANUP TARGET: Project 521 (${project.projectCode})`);
  console.log(`  Ranges: 2026-07-04 to 2026-07-16 AND 2026-07-21 to 2026-07-31`);
  console.log(`======================================================`);
  console.log(`Found:`);
  console.log(`  - Daily Sheets: ${dailySheets.length}`);
  dailySheets.forEach((s) => {
    console.log(`    • ${s.date.toISOString().split('T')[0]} | Supervisor: ${s.supervisor?.fullName || s.supervisor?.username} (@${s.supervisor?.username}) | Entries: ${s._count.timeEntries} | Assignments: ${s._count.assignments}`);
  });
  console.log(`  - Total Time Entries: ${timeEntries.length}`);
  console.log(`  - Total Labor Activity Splits: ${splitsCount}`);
  console.log(`  - Total Daily Assignments: ${assignmentsCount}`);

  if (isDryRun) {
    console.log(`\n[DRY RUN] No records were deleted. Run without --dry-run to execute deletion.`);
    return;
  }

  console.log(`\nExecuting deletion...`);

  // 1. Delete Activity Splits
  const delSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({
    where: { timeEntryId: { in: timeEntryIds } },
  });
  console.log(`✓ Deleted ${delSplits.count} Labor Activity Splits.`);

  // 2. Delete Time Entries
  const delTimeEntries = await prisma.mF_OP_TimeEntry.deleteMany({
    where: { id: { in: timeEntryIds } },
  });
  console.log(`✓ Deleted ${delTimeEntries.count} Time Entries.`);

  // 3. Delete Daily Assignments
  const delAssignments = await prisma.mF_OP_DailyAssignment.deleteMany({
    where: { dailySheetId: { in: dailySheetIds } },
  });
  console.log(`✓ Deleted ${delAssignments.count} Daily Assignments.`);

  // 4. Delete Daily Sheets
  const delSheets = await prisma.mF_OP_DailySheet.deleteMany({
    where: { id: { in: dailySheetIds } },
  });
  console.log(`✓ Deleted ${delSheets.count} Daily Sheets.`);

  console.log(`\nSuccessfully cleaned all records for July 4-16 and July 21-31 in Project 521!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
