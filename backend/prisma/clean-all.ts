import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧹 Mäga Database Reset & Clean Seed Script');
  console.log('   Preserves: SuperAdmin and Admin accounts');
  console.log('   Wipes: Test transactions, employees, equipment, partners, etc.');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. CLEAN LEVEL 3: OPERATIONAL TRANSACTIONS & LOGS (Child records first)
  console.log('1️⃣  Cleaning operational transactions & daily sheets...');
  const delLaborSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({});
  const delEqLogActs = await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({});
  const delEqLogs = await prisma.mF_OP_EquipmentDailyLog.deleteMany({});
  const delTimeEntries = await prisma.mF_OP_TimeEntry.deleteMany({});
  const delDailyEqAssigns = await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({});
  const delDailyAssigns = await prisma.mF_OP_DailyAssignment.deleteMany({});
  const delDailySheets = await prisma.mF_OP_DailySheet.deleteMany({});
  console.log(`   - Labor Activity Splits deleted: ${delLaborSplits.count}`);
  console.log(`   - Equipment Daily Logs deleted: ${delEqLogs.count}`);
  console.log(`   - Time Entries deleted: ${delTimeEntries.count}`);
  console.log(`   - Daily Equipment Assignments deleted: ${delDailyEqAssigns.count}`);
  console.log(`   - Daily Labor Assignments deleted: ${delDailyAssigns.count}`);
  console.log(`   - Daily Sheets deleted: ${delDailySheets.count}`);

  // 2. CLEAN LEVEL 2: PROJECT SITE OPERATIONAL MASTERS
  console.log('\n2️⃣  Cleaning project site resources...');
  const delCalDays = await prisma.mF_P_CalendarDay.deleteMany({});
  const delTransfers = await prisma.mF_G_EmployeeTransfer.deleteMany({});
  const delSiteEmps = await prisma.mF_P_Employee.deleteMany({});
  const delSiteEq = await prisma.mF_P_Equipment.deleteMany({});
  const delSiteActs = await prisma.mF_P_ActivityCode.deleteMany({});
  console.log(`   - Calendar Days deleted: ${delCalDays.count}`);
  console.log(`   - Employee Transfers deleted: ${delTransfers.count}`);
  console.log(`   - Site Employees deleted: ${delSiteEmps.count}`);
  console.log(`   - Site Equipment deleted: ${delSiteEq.count}`);
  console.log(`   - Site Activity Codes deleted: ${delSiteActs.count}`);

  // 3. CLEAN USERS: Keep only role 'admin', delete supervisors/test users
  console.log('\n3️⃣  Cleaning site users (Preserving Admin)...');
  const delSupUsers = await prisma.mF_P_User.deleteMany({
    where: {
      role: { not: 'admin' },
    },
  });
  console.log(`   - Non-admin site users deleted (supervisors): ${delSupUsers.count}`);

  // 4. CLEAN EXTRA PROJECTS: Keep base projects (PRJ531, PRJ001) for the Admin account
  console.log('\n4️⃣  Cleaning extra demo projects (Preserving Base Projects for Admin)...');
  // First ensure base project PRJ531 exists
  let baseProject = await prisma.mF_P_Project.findFirst({
    where: { projectCode: 'PRJ531' },
  });

  if (!baseProject) {
    baseProject = await prisma.mF_P_Project.create({
      data: {
        projectCode: 'PRJ531',
        projectName: 'Walgama Diyagama Road (531M)',
        subdomain: '531',
        status: 'active',
      },
    });
    console.log(`   - Recreated base project: ${baseProject.projectCode}`);
  }

  // Delete all projects other than PRJ531 and PRJ001
  const delProjects = await prisma.mF_P_Project.deleteMany({
    where: {
      projectCode: {
        notIn: ['PRJ531', 'PRJ001'],
      },
    },
  });
  console.log(`   - Extra test projects deleted: ${delProjects.count}`);

  // 5. CLEAN LEVEL 1: CORPORATE GLOBAL MASTER DATA
  console.log('\n5️⃣  Cleaning corporate master data (Employees, Equipment, Partners, Activity Codes)...');
  const delCorpEmps = await prisma.mF_G_Employee.deleteMany({});
  const delCorpEq = await prisma.mF_G_Equipment.deleteMany({});
  const delCorpActs = await prisma.mF_G_ActivityCode.deleteMany({});
  const delBps = await prisma.mF_G_BusinessPartner.deleteMany({});
  console.log(`   - Corporate Employees deleted: ${delCorpEmps.count}`);
  console.log(`   - Corporate Equipment deleted: ${delCorpEq.count}`);
  console.log(`   - Corporate Activity Codes deleted: ${delCorpActs.count}`);
  console.log(`   - Business Partners deleted: ${delBps.count}`);

  // 6. VERIFY & ENSURE SUPERADMIN & ADMIN ACCOUNTS
  console.log('\n6️⃣  Verifying SuperAdmin & Admin accounts...');
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // Super Admin in MF_G_SUPER_ADMIN
  const superAdmin = await prisma.mF_G_SuperAdmin.upsert({
    where: { username: 'superadmin' },
    update: {
      status: 'active',
    },
    create: {
      username: 'superadmin',
      email: 'admin@maga.lk',
      fullName: 'Mäga Central Super Administrator',
      passwordHash: defaultPasswordHash,
      status: 'active',
    },
  });
  console.log(`   ✅ SuperAdmin active: "${superAdmin.username}" (Password: admin123)`);

  // Project Admin in MF_L_USER attached to baseProject (PRJ531)
  const projectAdmin = await prisma.mF_P_User.upsert({
    where: {
      projectId_username: {
        projectId: baseProject.id,
        username: 'admin',
      },
    },
    update: {
      role: 'admin',
      status: 'active',
    },
    create: {
      projectId: baseProject.id,
      username: 'admin',
      fullName: 'Project Administrator (531M)',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      status: 'active',
    },
  });
  console.log(`   ✅ Project Admin active: "${projectAdmin.username}" for ${baseProject.projectCode} (Password: admin123)`);

  // 7. ENSURE ESSENTIAL SYSTEM LOOKUPS (DayTypes & UnitMasters)
  console.log('\n7️⃣  Ensuring essential system lookups (Units & DayTypes)...');
  const unitCount = await prisma.mF_G_UnitMaster.count();
  if (unitCount === 0) {
    const units = [
      { code: 'Hrs', name: 'Running Hours', category: 'meter' },
      { code: 'Days', name: 'Daily Utilization', category: 'day' },
      { code: 'mth', name: 'Monthly Calendar', category: 'month' },
      { code: 'km', name: 'Kilometers Mileage', category: 'mileage' },
      { code: 'EX.hrs', name: 'Excavation Extra Hours', category: 'meter' },
      { code: 'ton', name: 'Metric Tonne Capacity', category: 'weight' },
    ];
    for (const u of units) {
      await prisma.mF_G_UnitMaster.create({ data: u });
    }
    console.log(`   - Seeded ${units.length} Unit Masters`);
  } else {
    console.log(`   - Unit Masters intact: ${unitCount} units`);
  }

  const dayTypeCount = await prisma.mF_G_DayType.count();
  if (dayTypeCount === 0) {
    const dayTypes = [
      { code: 'NORMAL', name: 'Normal Day', rateMultiplier: 1.0 },
      { code: 'SATURDAY', name: 'Saturday', rateMultiplier: 1.0 },
      { code: 'SUNDAY', name: 'Sunday', rateMultiplier: 1.5 },
      { code: 'SHUTDOWN', name: 'Shutdown', rateMultiplier: 1.0 },
      { code: 'POYA', name: 'Public Holiday', rateMultiplier: 2.0 },
    ];
    for (const dt of dayTypes) {
      await prisma.mF_G_DayType.create({ data: dt });
    }
    console.log(`   - Seeded ${dayTypes.length} Day Types`);
  } else {
    console.log(`   - Day Types intact: ${dayTypeCount} types`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 Database Cleanup Complete!');
  console.log('   - Database is clean and ready for fresh testing / production.');
  console.log('   - SuperAdmin Login: username="superadmin", password="admin123"');
  console.log('   - Project Admin Login: username="admin", password="admin123"');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
