import prisma from '../src/config/prisma';

async function backfill() {
  console.log('🔄 Starting backfill of current_project_id from current_working_project...');

  // 1. Load all projects
  const projects = await prisma.mF_P_Project.findMany({
    select: { id: true, projectCode: true, projectName: true, subdomain: true },
  });
  console.log(`Found ${projects.length} projects in database.`);

  const resolveProjectId = (val?: string | null) => {
    if (!val) return null;
    const clean = val.trim().toLowerCase();
    const found = projects.find(
      (p) =>
        p.id.toLowerCase() === clean ||
        p.projectCode.toLowerCase() === clean ||
        p.projectName.toLowerCase() === clean ||
        p.subdomain.toLowerCase() === clean
    );
    return found ? found.id : null;
  };

  // 2. Backfill Equipment
  const rawEquipments = await prisma.$queryRaw<Array<{ corporate_equipment_id: string; current_working_project: string | null }>>`
    SELECT corporate_equipment_id, current_working_project FROM "MF_G_EQUIPMENT" WHERE current_project_id IS NULL AND current_working_project IS NOT NULL
  `;
  console.log(`Found ${rawEquipments.length} equipments needing backfill.`);

  let eqUpdated = 0;
  for (const eq of rawEquipments) {
    const projId = resolveProjectId(eq.current_working_project);
    if (projId) {
      await prisma.$executeRaw`
        UPDATE "MF_G_EQUIPMENT" SET current_project_id = ${projId} WHERE corporate_equipment_id = ${eq.corporate_equipment_id}
      `;
      eqUpdated++;
    }
  }
  console.log(`✅ Updated ${eqUpdated} / ${rawEquipments.length} equipment records with current_project_id.`);

  // 3. Backfill Employees
  const rawEmployees = await prisma.$queryRaw<Array<{ corporate_employee_id: string; current_working_project: string | null }>>`
    SELECT corporate_employee_id, current_working_project FROM "MF_G_EMPLOYEE" WHERE current_project_id IS NULL AND current_working_project IS NOT NULL
  `;
  console.log(`Found ${rawEmployees.length} employees needing backfill.`);

  let empUpdated = 0;
  for (const emp of rawEmployees) {
    const projId = resolveProjectId(emp.current_working_project);
    if (projId) {
      await prisma.$executeRaw`
        UPDATE "MF_G_EMPLOYEE" SET current_project_id = ${projId} WHERE corporate_employee_id = ${emp.corporate_employee_id}
      `;
      empUpdated++;
    }
  }
  console.log(`✅ Updated ${empUpdated} / ${rawEmployees.length} employee records with current_project_id.`);

  // 4. Verification Check
  const counts = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) as count FROM "MF_G_EQUIPMENT" WHERE current_project_id IS NOT NULL
  `;
  console.log(`Total equipment with valid foreign key: ${counts[0].count}`);

  console.log('🎉 Backfill completed successfully!');
  await prisma.$disconnect();
}

backfill().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
