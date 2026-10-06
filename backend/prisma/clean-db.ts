import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting Database Cleanup...');

  
  console.log('Cleaning transactional records...');
  await prisma.laborActivitySplit.deleteMany({});
  await prisma.operatorTimeEntry.deleteMany({});
  await prisma.equipmentDailyLogActivity.deleteMany({});
  await prisma.timeEntry.deleteMany({});
  await prisma.equipmentDailyLog.deleteMany({});
  
  await prisma.dailyAssignment.deleteMany({});
  await prisma.dailyOperatorAssignment.deleteMany({});
  await prisma.dailyEquipmentAssignment.deleteMany({});
  await prisma.dailySheet.deleteMany({});

  // 2. Delete Master Data (Employees, Equipment, Codes)
  console.log('Cleaning master data...');
  await prisma.equipmentUnitRate.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.activityCode.deleteMany({});
  await prisma.businessPartner.deleteMany({});
  
  await prisma.tradeGroup.deleteMany({});
  await prisma.unitMaster.deleteMany({});
  await prisma.calendarDay.deleteMany({});
  await prisma.dayType.deleteMany({});

  // 3. Delete Corporate Master Data
  console.log('Cleaning corporate master data...');
  await prisma.corporateEmployee.deleteMany({});
  await prisma.corporateEquipment.deleteMany({});
  await prisma.corporateActivityCode.deleteMany({});
  await prisma.corporateBusinessPartner.deleteMany({});
  await prisma.corporateProject.deleteMany({});

  // 4. Delete Users (Except Super Admin)
  console.log('Cleaning users...');
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'super_admin',
      },
    },
  });
  console.log(`Deleted ${deletedUsers.count} non-super-admin users.`);

  console.log('✅ Database cleaned successfully! Only super_admin accounts and Tenants remain.');
}

main()
  .catch((e) => {
    console.error('Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
