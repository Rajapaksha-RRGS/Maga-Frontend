import prisma from '../src/config/prisma';

async function main() {
  console.log('🧹 Clearing Project Site Operational Tables (keeping Corporate Master Tables intact)...');

  // 1. Transactional & daily logs
  await prisma.laborActivitySplit.deleteMany({});
  await prisma.equipmentDailyLogActivity.deleteMany({});
  await prisma.equipmentDailyLog.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.dailyAssignment.deleteMany({});
  await prisma.dailyEquipmentAssignment.deleteMany({});
  await prisma.dailySheet.deleteMany({});

  // 2. Project Site Operational Master Records
  await prisma.calendarDay.deleteMany({});
  await prisma.employeeTransfer.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.activityCode.deleteMany({});

  console.log('✅ Project site operational tables cleared!');
  
  const corpBpCount = await prisma.corporateBusinessPartner.count();
  const corpEqCount = await prisma.corporateEquipment.count();
  const corpEmpCount = await prisma.corporateEmployee.count();
  const corpActCount = await prisma.corporateActivityCode.count();
  const projCount = await prisma.project.count();

  console.log(`📊 Corporate Master Data Status:`);
  console.log(`   - Corporate Business Partners: ${corpBpCount}`);
  console.log(`   - Corporate Equipment: ${corpEqCount}`);
  console.log(`   - Corporate Employees: ${corpEmpCount}`);
  console.log(`   - Corporate Activity Codes: ${corpActCount}`);
  console.log(`   - Unified Projects: ${projCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
