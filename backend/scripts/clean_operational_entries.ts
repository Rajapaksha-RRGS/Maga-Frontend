/**
 * clean_operational_entries.ts
 * 
 * Safely removes all Level 3 Operational Data Entries:
 * 1. Labor Activity Splits (MF_OP_LaborActivitySplit)
 * 2. Time Entries (MF_OP_TimeEntry)
 * 3. Daily Labor Assignments (MF_OP_DailyAssignment)
 * 4. Equipment Daily Log Activities (MF_OP_EquipmentDailyLogActivity)
 * 5. Equipment Daily Logs (MF_OP_EquipmentDailyLog)
 * 6. Daily Equipment Assignments (MF_OP_DailyEquipmentAssignment)
 * 7. Daily Sheets (MF_OP_DailySheet)
 * 
 * STRICTLY PRESERVES:
 * - Projects (MF_P_Project)
 * - Users / Admins / Supervisors (MF_P_User, MF_G_SuperAdmin)
 * - Corporate & Project Employees (MF_G_Employee, MF_P_Employee)
 * - Corporate & Project Equipment (MF_G_Equipment, MF_P_Equipment)
 * - Corporate & Project Activity Codes (MF_G_ActivityCode, MF_P_ActivityCode)
 * - Business Partners (MF_G_BusinessPartner)
 * - Trade Groups & Day Types
 */

import prisma from '../src/config/prisma';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function main() {
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     CLEANING ALL OPERATIONAL DATA ENTRIES           ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  console.log(`🔍 Checking current records in database...`);
  const before = {
    timeEntries: await prisma.mF_OP_TimeEntry.count(),
    laborSplits: await prisma.mF_OP_LaborActivitySplit.count(),
    dailyAssignments: await prisma.mF_OP_DailyAssignment.count(),
    eqLogActivities: await prisma.mF_OP_EquipmentDailyLogActivity.count(),
    equipmentLogs: await prisma.mF_OP_EquipmentDailyLog.count(),
    dailyEqAssignments: await prisma.mF_OP_DailyEquipmentAssignment.count(),
    dailySheets: await prisma.mF_OP_DailySheet.count(),
    // Master data to be preserved
    projectEmployees: await prisma.mF_P_Employee.count(),
    corporateEmployees: await prisma.mF_G_Employee.count(),
    projectEquipment: await prisma.mF_P_Equipment.count(),
    corporateEquipment: await prisma.mF_G_Equipment.count(),
    businessPartners: await prisma.mF_G_BusinessPartner.count(),
    activityCodesGlobal: await prisma.mF_G_ActivityCode.count(),
    activityCodesProject: await prisma.mF_P_ActivityCode.count(),
    projects: await prisma.mF_P_Project.count(),
    users: await prisma.mF_P_User.count(),
  };

  console.log(`📊 Records to be Removed:`);
  console.log(`  • Time Entries (Labor)          : ${RED}${before.timeEntries}${RESET}`);
  console.log(`  • Labor Activity Splits         : ${RED}${before.laborSplits}${RESET}`);
  console.log(`  • Daily Labor Assignments       : ${RED}${before.dailyAssignments}${RESET}`);
  console.log(`  • Equipment Log Activities      : ${RED}${before.eqLogActivities}${RESET}`);
  console.log(`  • Equipment Daily Logs          : ${RED}${before.equipmentLogs}${RESET}`);
  console.log(`  • Daily Equipment Assignments   : ${RED}${before.dailyEqAssignments}${RESET}`);
  console.log(`  • Daily Sheets                  : ${RED}${before.dailySheets}${RESET}`);

  console.log(`\n🛡️ Master Data to PRESERVE:`);
  console.log(`  • Project Employees             : ${GREEN}${before.projectEmployees}${RESET}`);
  console.log(`  • Corporate Employees           : ${GREEN}${before.corporateEmployees}${RESET}`);
  console.log(`  • Project Equipment             : ${GREEN}${before.projectEquipment}${RESET}`);
  console.log(`  • Corporate Equipment           : ${GREEN}${before.corporateEquipment}${RESET}`);
  console.log(`  • Business Partners             : ${GREEN}${before.businessPartners}${RESET}`);
  console.log(`  • Global Activity Codes         : ${GREEN}${before.activityCodesGlobal}${RESET}`);
  console.log(`  • Project Activity Codes        : ${GREEN}${before.activityCodesProject}${RESET}`);
  console.log(`  • Projects                      : ${GREEN}${before.projects}${RESET}`);
  console.log(`  • Users                         : ${GREEN}${before.users}${RESET}\n`);

  console.log(`${YELLOW}⚡ Executing deletion in transactional order...${RESET}`);

  // 1. Delete Labor Activity Splits
  const delSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delSplits.count} Labor Activity Splits`);

  // 2. Delete Time Entries
  const delTimeEntries = await prisma.mF_OP_TimeEntry.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delTimeEntries.count} Time Entries`);

  // 3. Delete Daily Labor Assignments
  const delAssignments = await prisma.mF_OP_DailyAssignment.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delAssignments.count} Daily Labor Assignments`);

  // 4. Delete Equipment Daily Log Activities
  const delEqLogActs = await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delEqLogActs.count} Equipment Daily Log Activities`);

  // 5. Delete Equipment Daily Logs
  const delEqLogs = await prisma.mF_OP_EquipmentDailyLog.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delEqLogs.count} Equipment Daily Logs`);

  // 6. Delete Daily Equipment Assignments
  const delDailyEqAssigns = await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delDailyEqAssigns.count} Daily Equipment Assignments`);

  // 7. Delete Daily Sheets
  const delDailySheets = await prisma.mF_OP_DailySheet.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delDailySheets.count} Daily Sheets`);

  // Verification
  const after = {
    timeEntries: await prisma.mF_OP_TimeEntry.count(),
    laborSplits: await prisma.mF_OP_LaborActivitySplit.count(),
    dailyAssignments: await prisma.mF_OP_DailyAssignment.count(),
    eqLogActivities: await prisma.mF_OP_EquipmentDailyLogActivity.count(),
    equipmentLogs: await prisma.mF_OP_EquipmentDailyLog.count(),
    dailyEqAssignments: await prisma.mF_OP_DailyEquipmentAssignment.count(),
    dailySheets: await prisma.mF_OP_DailySheet.count(),
    // Preserved
    projectEmployees: await prisma.mF_P_Employee.count(),
    corporateEmployees: await prisma.mF_G_Employee.count(),
    projectEquipment: await prisma.mF_P_Equipment.count(),
    corporateEquipment: await prisma.mF_G_Equipment.count(),
    businessPartners: await prisma.mF_G_BusinessPartner.count(),
    activityCodesGlobal: await prisma.mF_G_ActivityCode.count(),
    activityCodesProject: await prisma.mF_P_ActivityCode.count(),
    projects: await prisma.mF_P_Project.count(),
    users: await prisma.mF_P_User.count(),
  };

  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                 CLEANUP VERIFICATION                ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`🗑️ Time Entries Left            : ${BOLD}${after.timeEntries}${RESET}`);
  console.log(`🗑️ Labor Activity Splits Left   : ${BOLD}${after.laborSplits}${RESET}`);
  console.log(`🗑️ Daily Labor Assignments Left : ${BOLD}${after.dailyAssignments}${RESET}`);
  console.log(`🗑️ Equipment Log Activities Left: ${BOLD}${after.eqLogActivities}${RESET}`);
  console.log(`🗑️ Equipment Daily Logs Left    : ${BOLD}${after.equipmentLogs}${RESET}`);
  console.log(`🗑️ Daily Equipment Assigns Left : ${BOLD}${after.dailyEqAssignments}${RESET}`);
  console.log(`🗑️ Daily Sheets Left            : ${BOLD}${after.dailySheets}${RESET}`);
  console.log(`-----------------------------------------------------`);
  console.log(`🛡️ Project Employees Intact     : ${GREEN}${BOLD}${after.projectEmployees}${RESET}`);
  console.log(`🛡️ Corporate Employees Intact   : ${GREEN}${BOLD}${after.corporateEmployees}${RESET}`);
  console.log(`🛡️ Project Equipment Intact     : ${GREEN}${BOLD}${after.projectEquipment}${RESET}`);
  console.log(`🛡️ Corporate Equipment Intact   : ${GREEN}${BOLD}${after.corporateEquipment}${RESET}`);
  console.log(`🛡️ Business Partners Intact     : ${GREEN}${BOLD}${after.businessPartners}${RESET}`);
  console.log(`🛡️ Projects Intact              : ${GREEN}${BOLD}${after.projects}${RESET}`);
  console.log(`🛡️ Users Intact                 : ${GREEN}${BOLD}${after.users}${RESET}`);
  console.log(`${CYAN}=====================================================${RESET}`);
  console.log(`\n${GREEN}${BOLD}🎉 ALL OPERATIONAL DATA ENTRIES CLEANED SUCCESSFULLY!${RESET}\n`);
}

main()
  .catch((e) => {
    console.error(`\n${RED}❌ Error during cleanup:${RESET}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

