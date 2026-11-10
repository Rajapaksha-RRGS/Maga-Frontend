import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import prisma from '../src/config/prisma';

async function main() {
  const startDate = new Date('2026-07-01T00:00:00.000Z');
  const endDate = new Date('2026-07-15T23:59:59.999Z');

  console.log(`Checking records between 2026-07-01 and 2026-07-15...`);

  // Find time entries in date range
  const entries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { id: true, dailySheetId: true },
  });

  const entryIds = entries.map((e) => e.id);
  const dailySheetIds = Array.from(new Set(entries.map((e) => e.dailySheetId).filter(Boolean))) as string[];

  console.log(`Found ${entryIds.length} Time Entries to remove.`);

  if (entryIds.length > 0) {
    // 1. Delete associated splits
    const deletedSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({
      where: {
        timeEntryId: { in: entryIds },
      },
    });
    console.log(`✓ Deleted ${deletedSplits.count} Labor Activity Splits.`);

    // 2. Delete time entries
    const deletedEntries = await prisma.mF_OP_TimeEntry.deleteMany({
      where: {
        id: { in: entryIds },
      },
    });
    console.log(`✓ Deleted ${deletedEntries.count} Time Entries.`);
  }

  // 3. Clean Daily Assignments for these daily sheets if empty
  if (dailySheetIds.length > 0) {
    // Check if daily sheets have remaining entries
    for (const dsId of dailySheetIds) {
      const remaining = await prisma.mF_OP_TimeEntry.count({
        where: { dailySheetId: dsId },
      });
      if (remaining === 0) {
        await prisma.mF_OP_DailyAssignment.deleteMany({
          where: { dailySheetId: dsId },
        });
        await prisma.mF_OP_DailySheet.delete({
          where: { id: dsId },
        }).catch(() => {});
      }
    }
    console.log(`✓ Cleaned empty Daily Sheets & Assignments for the date range.`);
  }

  console.log(`\n🎉 All labor operational entries from 01/07/2026 to 15/07/2026 have been successfully cleaned!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

