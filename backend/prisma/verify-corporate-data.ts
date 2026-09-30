import prisma from '../src/config/prisma';

async function main() {
  const emps = await prisma.corporateEmployee.findMany({ take: 5 });
  console.log('Sample Corporate Employees:');
  console.log(JSON.stringify(emps, null, 2));

  const equips = await prisma.corporateEquipment.findMany({ take: 5 });
  console.log('Sample Corporate Equipment:');
  console.log(JSON.stringify(equips, null, 2));

  const tenantEmps = await prisma.employee.count();
  const tenantEqs = await prisma.equipment.count();
  const tenantBps = await prisma.businessPartner.count();

  console.log(`Tenant local records: Employees=${tenantEmps}, Equipment=${tenantEqs}, BPs=${tenantBps}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
