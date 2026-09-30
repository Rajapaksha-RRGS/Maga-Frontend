import prisma from '../src/config/prisma';

async function main() {
  console.log('🧹 Clearing only Tenant Local Tables (keeping Corporate Master Tables intact)...');

  // 1. Transactional & daily logs
  await prisma.laborActivitySplit.deleteMany({});
  await prisma.operatorTimeEntry.deleteMany({});
  await prisma.equipmentDailyLogActivity.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.equipmentDailyLog.deleteMany({});
  
  await prisma.dailyAssignment.deleteMany({});
  await prisma.dailyOperatorAssignment.deleteMany({});
  await prisma.dailyEquipmentAssignment.deleteMany({});
  await prisma.dailySheet.deleteMany({});

  // 2. Tenant Local Master Records (Employee, Equipment, BusinessPartner, ActivityCode)
  await prisma.equipmentUnitRate.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.activityCode.deleteMany({});
  await prisma.businessPartner.deleteMany({});

  console.log('✅ Tenant local tables cleared!');
  
  const corpBpCount = await prisma.corporateBusinessPartner.count();
  const corpEqCount = await prisma.corporateEquipment.count();
  const corpEmpCount = await prisma.corporateEmployee.count();
  const corpActCount = await prisma.corporateActivityCode.count();
  const corpProjCount = await prisma.corporateProject.count();

  console.log(`📊 Corporate Master Data Status:`);
  console.log(`   - Corporate Business Partners: ${corpBpCount}`);
  console.log(`   - Corporate Equipment: ${corpEqCount}`);
  console.log(`   - Corporate Employees: ${corpEmpCount}`);
  console.log(`   - Corporate Activity Codes: ${corpActCount}`);
  console.log(`   - Corporate Projects: ${corpProjCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
