import prisma from '../src/config/prisma';

async function main() {
  console.log('🧹 Starting Database Cleanup for Unified Schema...');

  // 1. Transactional & Log details (Child records)
  console.log('1. Cleaning operational transactions & log details...');
  await prisma.mF_OP_LaborActivitySplit.deleteMany({});
  await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({});
  await prisma.mF_OP_EquipmentDailyLog.deleteMany({});
  await prisma.mF_OP_TimeEntry.deleteMany({});
  await prisma.mF_OP_DailyAssignment.deleteMany({});
  await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({});
  await prisma.mF_OP_DailySheet.deleteMany({});

  // 2. Project Site Operational Master Data
  console.log('2. Cleaning project site operational masters...');
  await prisma.mF_P_CalendarDay.deleteMany({});
  await prisma.mF_G_EmployeeTransfer.deleteMany({});
  await prisma.mF_P_Employee.deleteMany({});
  await prisma.mF_P_Equipment.deleteMany({});
  await prisma.mF_P_ActivityCode.deleteMany({});
  await prisma.mF_P_User.deleteMany({
    where: { role: { not: 'super_admin' } },
  });

  // 3. Global Corporate Master Data
  console.log('3. Cleaning corporate global master data...');
  await prisma.mF_G_Employee.deleteMany({});
  await prisma.mF_G_Equipment.deleteMany({});
  await prisma.mF_G_ActivityCode.deleteMany({});
  await prisma.mF_G_TradeGroup.deleteMany({});
  await prisma.mF_G_BusinessPartner.deleteMany({});
  await prisma.mF_G_DayType.deleteMany({});
  await prisma.mF_G_UnitMaster.deleteMany({});

  console.log('✅ Database cleaned successfully! SuperAdmins and base Projects remain intact.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
