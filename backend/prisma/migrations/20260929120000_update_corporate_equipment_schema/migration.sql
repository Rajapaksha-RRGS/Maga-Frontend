-- AlterTable corporate_equipment: Support user defined columns and surrogate UUID PK
ALTER TABLE "corporate_equipment" 
  ADD COLUMN IF NOT EXISTS "standard_equipment_number" TEXT,
  ADD COLUMN IF NOT EXISTS "equipment_name" TEXT,
  ADD COLUMN IF NOT EXISTS "erp_new_code" TEXT;

-- Drop unique constraint on legacy code if exists
ALTER TABLE "corporate_equipment" DROP CONSTRAINT IF EXISTS "corporate_equipment_code_key";
DROP INDEX IF EXISTS "corporate_equipment_code_key";

-- Populate new columns from legacy columns if any exist
UPDATE "corporate_equipment"
SET "standard_equipment_number" = COALESCE("standard_equipment_number", "maga_no", "code"),
    "equipment_name" = COALESCE("equipment_name", "description"),
    "erp_new_code" = COALESCE("erp_new_code", "erp_suffix_code", "code")
WHERE "standard_equipment_number" IS NULL;

-- Make standard_equipment_number, equipment_name, erp_new_code NOT NULL
ALTER TABLE "corporate_equipment"
  ALTER COLUMN "standard_equipment_number" SET NOT NULL,
  ALTER COLUMN "equipment_name" SET NOT NULL,
  ALTER COLUMN "erp_new_code" SET NOT NULL;

-- Alter code to be nullable
ALTER TABLE "corporate_equipment" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "corporate_equipment" ALTER COLUMN "description" DROP NOT NULL;

-- Create unique index on erp_new_code
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_equipment_erp_new_code_key" ON "corporate_equipment"("erp_new_code");

-- Create search/filter indexes
CREATE INDEX IF NOT EXISTS "corporate_equipment_standard_equipment_number_idx" ON "corporate_equipment"("standard_equipment_number");
CREATE INDEX IF NOT EXISTS "corporate_equipment_vehicle_no_idx" ON "corporate_equipment"("vehicle_no");
