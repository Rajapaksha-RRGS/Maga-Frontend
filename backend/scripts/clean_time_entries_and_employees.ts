/**
 * clean_time_entries_and_employees.ts
 * 
 * Safely removes:
 * 1. All Time Entries (MF_OP_TimeEntry) & Splits (MF_OP_LaborActivitySplit)
 * 2. All Daily Assignments (MF_OP_DailyAssignment)
 * 3. All Site Employees (MF_P_Employee)
 * 4. All Corporate Employees (MF_G_Employee) & Transfers
 * 
 * STRICTLY PRESERVES:
 * - Projects (MF_P_Project)
 * - Users / Admins / Supervisors (MF_P_User, MF_G_SuperAdmin)
 * - Business Partners (MF_G_BusinessPartner)
 * - Activity Codes (MF_G_ActivityCode, MF_P_ActivityCode)
 * - Trade Groups (MF_G_TradeGroup)
 * - Equipment (MF_G_Equipment, MF_P_Equipment)
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
  console.log(`${CYAN}${BOLD}    CLEANING TIME ENTRIES & EMPLOYEES DATA           ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  console.log(`🔍 Checking current database records...`);
  const beforeCounts = {
    timeEntries: await prisma.mF_OP_TimeEntry.count(),
    splits: await prisma.mF_OP_LaborActivitySplit.count(),
    dailyAssignments: await prisma.mF_OP_DailyAssignment.count(),
    projectEmployees: await prisma.mF_P_Employee.count(),
    corporateEmployees: await prisma.mF_G_Employee.count(),
    transfers: await prisma.mF_G_EmployeeTransfer.count(),
    // Preserved tables
    businessPartners: await prisma.mF_G_BusinessPartner.count(),
    activityCodes: await prisma.mF_P_ActivityCode.count(),
    projects: await prisma.mF_P_Project.count(),
    users: await prisma.mF_P_User.count(),
  };

  console.log(`📊 Current Counts:`);
  console.log(`  • Time Entries        : ${beforeCounts.timeEntries}`);
  console.log(`  • Activity Splits     : ${beforeCounts.splits}`);
  console.log(`  • Daily Assignments   : ${beforeCounts.dailyAssignments}`);
  console.log(`  • Project Employees   : ${beforeCounts.projectEmployees}`);
  console.log(`  • Corporate Employees : ${beforeCounts.corporateEmployees}`);
  console.log(`  • Business Partners   : ${beforeCounts.businessPartners} ${GREEN}(WILL PRESERVE)${RESET}`);
  console.log(`  • Activity Codes      : ${beforeCounts.activityCodes} ${GREEN}(WILL PRESERVE)${RESET}`);
  console.log(`  • Projects            : ${beforeCounts.projects} ${GREEN}(WILL PRESERVE)${RESET}`);
  console.log(`  • Users               : ${beforeCounts.users} ${GREEN}(WILL PRESERVE)${RESET}\n`);

  console.log(`${YELLOW}⚠️ Starting deletion in correct foreign key order...${RESET}`);

  // 1. Delete Labor Activity Splits
  const delSplits = await prisma.mF_OP_LaborActivitySplit.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delSplits.count} Labor Activity Splits`);

  // 2. Delete Time Entries
  const delTimeEntries = await prisma.mF_OP_TimeEntry.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delTimeEntries.count} Time Entries`);

  // 3. Delete Daily Assignments
  const delAssignments = await prisma.mF_OP_DailyAssignment.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delAssignments.count} Daily Assignments`);

  // 4. Detach operator relations from Equipment Daily Assignments (if any)
  await prisma.mF_OP_DailyEquipmentAssignment.updateMany({
    where: { operatorId: { not: null } },
    data: { operatorId: null },
  });

  // 5. Delete Employee Transfers
  const delTransfers = await prisma.mF_G_EmployeeTransfer.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delTransfers.count} Employee Transfers`);

  // 6. Delete Project Employees (MF_L_EMPLOYEE)
  const delProjEmployees = await prisma.mF_P_Employee.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delProjEmployees.count} Project Employees (MF_L_EMPLOYEE)`);

  // 7. Delete Corporate Employees (MF_G_EMPLOYEE)
  const delCorpEmployees = await prisma.mF_G_Employee.deleteMany({});
  console.log(`  ${GREEN}✓${RESET} Deleted ${delCorpEmployees.count} Corporate Employees (MF_G_EMPLOYEE)`);

  // Verification of Preserved Data
  const afterCounts = {
    timeEntries: await prisma.mF_OP_TimeEntry.count(),
    projectEmployees: await prisma.mF_P_Employee.count(),
    corporateEmployees: await prisma.mF_G_Employee.count(),
    businessPartners: await prisma.mF_G_BusinessPartner.count(),
    activityCodes: await prisma.mF_P_ActivityCode.count(),
    projects: await prisma.mF_P_Project.count(),
    users: await prisma.mF_P_User.count(),
  };

  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                 CLEANUP VERIFICATION                ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`🗑️ Time Entries Left       : ${BOLD}${afterCounts.timeEntries}${RESET} (Cleaned)`);
  console.log(`🗑️ Project Employees Left  : ${BOLD}${afterCounts.projectEmployees}${RESET} (Cleaned)`);
  console.log(`🗑️ Corporate Employees Left: ${BOLD}${afterCounts.corporateEmployees}${RESET} (Cleaned)`);
  console.log(`-----------------------------------------------------`);
  console.log(`🛡️ Business Partners Kept  : ${GREEN}${BOLD}${afterCounts.businessPartners}${RESET}`);
  console.log(`🛡️ Activity Codes Kept     : ${GREEN}${BOLD}${afterCounts.activityCodes}${RESET}`);
  console.log(`🛡️ Projects Kept           : ${GREEN}${BOLD}${afterCounts.projects}${RESET}`);
  console.log(`🛡️ Users Kept              : ${GREEN}${BOLD}${afterCounts.users}${RESET}`);
  console.log(`${CYAN}=====================================================${RESET}`);
  console.log(`\n${GREEN}${BOLD}🎉 CLEANUP COMPLETED SUCCESSFULLY!${RESET}\n`);
}

main()
  .catch((e) => {
    console.error(`\n${RED}Error during cleanup:${RESET}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

