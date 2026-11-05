const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateTradeGroups() {
  console.log('🔄 Starting Trade Group Daily Rate migration (x8)...');

  const allTgs = await prisma.mF_G_TradeGroup.findMany();
  console.log(`Found ${allTgs.length} trade groups in total.`);

  let updatedCount = 0;
  for (const tg of allTgs) {
    const currentRate = Number(tg.standardDailyRate);
    // If rate is less than 500, it was stored as an hourly rate (e.g., 75, 80, 85, 100, 110, 150)
    if (currentRate < 500 && currentRate > 0) {
      const newDailyRate = currentRate * 8;
      await prisma.mF_G_TradeGroup.update({
        where: { id: tg.id },
        data: {
          standardDailyRate: newDailyRate,
          standardOtRate: null, // Remove redundant stored OT rate
        },
      });
      updatedCount++;
      console.log(`  Updated [${tg.code}] ${tg.name}: ${currentRate}/hr -> ${newDailyRate}/day`);
    } else {
      console.log(`  Skipped [${tg.code}] ${tg.name}: ${currentRate} (already a full daily rate)`);
    }
  }

  console.log(`\n✅ Migration complete! Successfully updated ${updatedCount} trade groups to 8x daily rates.`);
}

updateTradeGroups()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

