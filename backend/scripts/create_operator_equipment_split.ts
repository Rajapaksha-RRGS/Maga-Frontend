import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('1. Creating table MF_L_OPERATOR_EQUIPMENT_SPLIT if not exists...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MF_L_OPERATOR_EQUIPMENT_SPLIT" (
      "operator_equipment_split_id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      "time_entry_id" TEXT NOT NULL REFERENCES "MF_L_TIME_ENTRY"("time_entry_id") ON DELETE CASCADE ON UPDATE CASCADE,
      "equipment_id" TEXT NOT NULL REFERENCES "MF_L_EQUIPMENT"("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "hours" NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "timeEntryId_equipmentId" UNIQUE ("time_entry_id", "equipment_id")
    );
  `);

  console.log('2. Creating indexes...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MF_L_OPERATOR_EQUIPMENT_SPLIT_time_entry_id_idx" 
    ON "MF_L_OPERATOR_EQUIPMENT_SPLIT"("time_entry_id");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MF_L_OPERATOR_EQUIPMENT_SPLIT_equipment_id_idx" 
    ON "MF_L_OPERATOR_EQUIPMENT_SPLIT"("equipment_id");
  `);

  console.log('3. Backfilling existing operator equipment records...');
  // Find all time entries that have an equipmentId assigned
  const backfillResult = await prisma.$executeRawUnsafe(`
    INSERT INTO "MF_L_OPERATOR_EQUIPMENT_SPLIT" ("operator_equipment_split_id", "time_entry_id", "equipment_id", "hours", "created_at")
    SELECT 
      gen_random_uuid()::text,
      te."time_entry_id",
      te."equipment_id",
      COALESCE(te."hours", te."shift_hours", 0.00),
      NOW()
    FROM "MF_L_TIME_ENTRY" te
    WHERE te."equipment_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "MF_L_OPERATOR_EQUIPMENT_SPLIT" oes 
        WHERE oes."time_entry_id" = te."time_entry_id" 
          AND oes."equipment_id" = te."equipment_id"
      );
  `);
  console.log('Backfill rows inserted:', backfillResult);

  // Check count in MF_L_OPERATOR_EQUIPMENT_SPLIT
  const count: any = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count FROM "MF_L_OPERATOR_EQUIPMENT_SPLIT";
  `);
  console.log('Total rows in MF_L_OPERATOR_EQUIPMENT_SPLIT:', count[0]?.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
