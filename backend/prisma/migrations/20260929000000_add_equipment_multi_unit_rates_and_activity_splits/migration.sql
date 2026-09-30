-- AlterTable corporate_equipment
ALTER TABLE "corporate_equipment" 
ADD COLUMN IF NOT EXISTS "vehicle_no" TEXT,
ADD COLUMN IF NOT EXISTS "maga_no" TEXT,
ADD COLUMN IF NOT EXISTS "condition" TEXT NOT NULL DEFAULT 'DRY',
ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'mth',
ADD COLUMN IF NOT EXISTS "erp_suffix_code" TEXT,
ADD COLUMN IF NOT EXISTS "daily_rate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "min_utilization" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "business_partner" TEXT;

-- AlterTable equipment
ALTER TABLE "equipment" 
ADD COLUMN IF NOT EXISTS "vehicle_no" TEXT,
ADD COLUMN IF NOT EXISTS "maga_no" TEXT,
ADD COLUMN IF NOT EXISTS "condition" TEXT NOT NULL DEFAULT 'DRY';

-- CreateTable equipment_unit_rates
CREATE TABLE IF NOT EXISTS "equipment_unit_rates" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "erp_billing_code" TEXT,
    "rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "min_utilization" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_unit_rates_pkey" PRIMARY KEY ("id")
);

-- Indexes for equipment_unit_rates
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_unit_rates_equipment_id_unit_key" ON "equipment_unit_rates"("equipment_id", "unit");
CREATE INDEX IF NOT EXISTS "equipment_unit_rates_equipment_id_idx" ON "equipment_unit_rates"("equipment_id");

-- Foreign key for equipment_unit_rates
ALTER TABLE "equipment_unit_rates" 
DROP CONSTRAINT IF EXISTS "equipment_unit_rates_equipment_id_fkey",
ADD CONSTRAINT "equipment_unit_rates_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable equipment_daily_logs
ALTER TABLE "equipment_daily_logs" 
ADD COLUMN IF NOT EXISTS "total_utilization" DECIMAL(8,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "condition" TEXT DEFAULT 'DRY',
ADD COLUMN IF NOT EXISTS "start_mileage" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "end_mileage" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "total_mileage" DECIMAL(10,2) DEFAULT 0.00;

-- CreateTable equipment_daily_log_activities
CREATE TABLE IF NOT EXISTS "equipment_daily_log_activities" (
    "id" TEXT NOT NULL,
    "daily_log_id" TEXT NOT NULL,
    "activity_code_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hrs',
    "utilization" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_daily_log_activities_pkey" PRIMARY KEY ("id")
);

-- Index for equipment_daily_log_activities
CREATE INDEX IF NOT EXISTS "equipment_daily_log_activities_daily_log_id_idx" ON "equipment_daily_log_activities"("daily_log_id");

-- Foreign keys for equipment_daily_log_activities
ALTER TABLE "equipment_daily_log_activities" 
DROP CONSTRAINT IF EXISTS "equipment_daily_log_activities_daily_log_id_fkey",
ADD CONSTRAINT "equipment_daily_log_activities_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "equipment_daily_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_daily_log_activities" 
DROP CONSTRAINT IF EXISTS "equipment_daily_log_activities_activity_code_id_fkey",
ADD CONSTRAINT "equipment_daily_log_activities_activity_code_id_fkey" FOREIGN KEY ("activity_code_id") REFERENCES "activity_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
