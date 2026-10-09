import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rawTradeGroups = [
  { code: 'ASP', name: 'Asphalt Laying', standardDailyRate: 100.0, standardOtRate: 110.0 },
  { code: 'MAL', name: 'Aluminium Fabricator', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MBB', name: 'Bar Bender', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MBL', name: 'Backlog Clearance Labour', standardDailyRate: 75.0, standardOtRate: 110.0 },
  { code: 'MCK', name: 'Cook', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MCP', name: 'Carpenters', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MCT', name: 'Trainee Carpenters', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MDH', name: 'Driver-Heavy Vehicle', standardDailyRate: 80.0, standardOtRate: 120.0 },
  { code: 'MDI', name: 'Driller', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MDL', name: 'Driver-Light Vehicle', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MDR', name: 'Driver', standardDailyRate: 85.0, standardOtRate: 127.5 },
  { code: 'MEH', name: 'Electrician Helper', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MEL', name: 'Electrician', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MFL', name: 'Flagman', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MGL', name: 'Galzier (Glass fixing)', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MHF', name: 'Office helper', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MHL', name: 'Lab Helper', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MHT', name: 'Stores Helper', standardDailyRate: 100.0, standardOtRate: 110.0 },
  { code: 'MJO', name: 'Joiner', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MME', name: 'Mechanic', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MMS', name: 'Mason', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MOA', name: 'Operator-Asphalt Paver', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MOC', name: 'Operator- Crane', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MOH', name: 'Operator-Heavy Land Equipment', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MOL', name: 'Operator-Light Equipment', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MOP', name: 'Operator-Plants', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MPA', name: 'Painter', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MPF', name: 'Pipe Fitter', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MPH', name: 'Operator Helper', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MPL', name: 'Plumber', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MRG', name: 'Rigger', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MRM', name: 'Rakeman', standardDailyRate: 110.0, standardOtRate: 175.0 },
  { code: 'MSG', name: 'Maga Security', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MSH', name: 'Survey Helper', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MSK', name: 'Skilled Worker', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MSM', name: 'Screedman', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MSS', name: 'Semi Skilled Worker', standardDailyRate: 80.0, standardOtRate: 120.0 },
  { code: 'MTC', name: 'Technician', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MTL', name: 'Tiler', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'MTN', name: 'Tinker', standardDailyRate: 150.0, standardOtRate: 225.0 },
  { code: 'MUS', name: 'Un Skilled Worker', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'MWL', name: 'Welder', standardDailyRate: 110.0, standardOtRate: 165.0 },
  { code: 'PLM', name: 'Plant Machine', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'PLO', name: 'Plant Overhead', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'PLT', name: 'Plant Labor', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'PMO', name: 'Plant Machine Overhead', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SAL', name: 'Supply - Aluminium Fabricator', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SBB', name: 'Supply - Bar Bender', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SCP', name: 'Supply - Carpenters', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SDH', name: 'Supply - Driver-Heavy Vehicle', standardDailyRate: 125.0, standardOtRate: 125.0 },
  { code: 'SDL', name: 'Supply - Driver-Light Vehicle', standardDailyRate: 110.0, standardOtRate: 110.0 },
  { code: 'SEH', name: 'Supply - Electrician Helper', standardDailyRate: 125.0, standardOtRate: 125.0 },
  { code: 'SEL', name: 'Supply - Electrician', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SFL', name: 'Supply - Flagman', standardDailyRate: 110.0, standardOtRate: 110.0 },
  { code: 'SGL', name: 'Supply - Galzier (Glass fixing)', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SGR', name: 'Supply - Grinder', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'SJO', name: 'Supply - Joiner', standardDailyRate: 110.0, standardOtRate: 110.0 },
  { code: 'SME', name: 'Supply - Mechanic', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SMS', name: 'Supply - Mason', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SOA', name: 'Supply - Operator-Asphalt Paver', standardDailyRate: 187.5, standardOtRate: 187.5 },
  { code: 'SOC', name: 'Supply - Operator- Crane', standardDailyRate: 187.5, standardOtRate: 187.5 },
  { code: 'SOH', name: 'Supply - Operator-Heavy Land Equipment', standardDailyRate: 187.5, standardOtRate: 187.5 },
  { code: 'SOL', name: 'Supply - Operator-Light Equipment', standardDailyRate: 187.5, standardOtRate: 187.5 },
  { code: 'SOP', name: 'Supply - Operator-Plants', standardDailyRate: 187.5, standardOtRate: 187.5 },
  { code: 'SPA', name: 'Supply - Painter', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SPF', name: 'Supply - Pipe Fitter', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SPH', name: 'Supply - Operator-Helper', standardDailyRate: 75.0, standardOtRate: 112.5 },
  { code: 'SPL', name: 'Supply - Plumber', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SRG', name: 'Supply - Rigger', standardDailyRate: 151.0, standardOtRate: 151.0 },
  { code: 'SSH', name: 'Supply - Survey Helper', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SSK', name: 'Supply - Skilled Worker', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SSP', name: 'Supply - Supervisor', standardDailyRate: 187.5, standardOtRate: 281.25 },
  { code: 'SSS', name: 'Supply - Semi Skilled Worker', standardDailyRate: 120.0, standardOtRate: 120.0 },
  { code: 'STL', name: 'Supply - Tiler', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'SUS', name: 'Supply - Un Skilled Worker', standardDailyRate: 110.0, standardOtRate: 110.0 },
  { code: 'SWL', name: 'Supply - Welder', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'ZCA', name: 'Cost Adjustment Labour', standardDailyRate: 150.0, standardOtRate: 150.0 },
  { code: 'ZLB', name: 'Historical trade Group', standardDailyRate: 150.0, standardOtRate: 150.0 },
];

async function main() {
  console.log('🔄 Cleaning old trade groups and seeding 78 new Trade Groups...');

  // 1. Temporarily clear tradeGroupId foreign keys from employees
  await prisma.mF_P_Employee.updateMany({
    data: { tradeGroupId: null },
  });
  await prisma.mF_G_Employee.updateMany({
    data: { tradeGroupId: null },
  });
  console.log('Cleared foreign key links on employees.');

  // 2. Delete all existing Trade Groups
  const deleted = await prisma.mF_G_TradeGroup.deleteMany({});
  console.log(`Deleted ${deleted.count} old trade groups.`);

  // 3. Batch create all 78 Trade Groups
  const created = await prisma.mF_G_TradeGroup.createMany({
    data: rawTradeGroups.map((tg) => ({
      code: tg.code,
      name: tg.name,
      standardDailyRate: tg.standardDailyRate,
      standardOtRate: tg.standardOtRate,
      status: 'active',
    })),
  });
  console.log(`✅ Successfully inserted ${created.count} Trade Groups!`);

  // 4. Re-map employees to new Trade Groups by best match
  const newTgs = await prisma.mF_G_TradeGroup.findMany();
  const nameToId = new Map<string, string>();
  for (const tg of newTgs) {
    nameToId.set(tg.name.toLowerCase().trim(), tg.id);
    nameToId.set(tg.code.toLowerCase().trim(), tg.id);
  }

  // Update Driver, Mason, Welder, Electrician, Helper, etc.
  const allCorporateEmps = await prisma.mF_G_Employee.findMany();
  for (const emp of allCorporateEmps) {
    let matchedId = null;
    const lowerName = emp.fullName.toLowerCase();
    if (lowerName.includes('driver')) matchedId = nameToId.get('driver') || nameToId.get('mdr');
    else if (lowerName.includes('mason')) matchedId = nameToId.get('mason') || nameToId.get('mms');
    else if (lowerName.includes('helper')) matchedId = nameToId.get('lab helper') || nameToId.get('mhl');
    else if (emp.isOperator) matchedId = nameToId.get('operator-plants') || nameToId.get('mop');
    else matchedId = nameToId.get('un skilled worker') || nameToId.get('mus');

    if (matchedId) {
      await prisma.mF_G_Employee.update({
        where: { id: emp.id },
        data: { tradeGroupId: matchedId },
      });
      await prisma.mF_P_Employee.updateMany({
        where: { corporateEmployeeId: emp.id },
        data: { tradeGroupId: matchedId },
      });
    }
  }
  console.log(`✅ Re-linked corporate & site employees to new trade groups.`);
}

main()
  .catch((e) => {
    console.error('Error seeding trade groups:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
