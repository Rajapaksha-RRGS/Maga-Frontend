-- AlterTable
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "available_units" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "cost_rate" DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "primary_unit" TEXT NOT NULL DEFAULT 'mth';

-- CreateTable
CREATE TABLE IF NOT EXISTS "corporate_equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "cost_rate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "type" TEXT,
    "model" TEXT,
    "registration_no" TEXT,
    "capacity" TEXT,
    "primary_unit" TEXT NOT NULL DEFAULT 'mth',
    "available_units" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_working_project" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "corporate_employees" (
    "id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "calling_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "nic_no" TEXT NOT NULL,
    "trade_group" TEXT NOT NULL,
    "is_operator" BOOLEAN NOT NULL DEFAULT false,
    "license_no" TEXT,
    "epf_no" TEXT,
    "business_partner_code" TEXT,
    "business_partner_name" TEXT,
    "current_working_project" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "corporate_business_partners" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'subcontractor',
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "rating" TEXT,
    "current_working_project" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_business_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "corporate_activity_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "search_key" TEXT,
    "activity_type" TEXT,
    "unit" TEXT,
    "time_unit" TEXT,
    "current_working_project" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_activity_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "corporate_projects" (
    "id" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "project_manager" TEXT,
    "address_code" TEXT,
    "project_name" TEXT,
    "enterprise_unit" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_equipment_code_key" ON "corporate_equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_employees_employee_code_key" ON "corporate_employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_business_partners_code_key" ON "corporate_business_partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_activity_codes_code_key" ON "corporate_activity_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "corporate_projects_project_code_key" ON "corporate_projects"("project_code");
