import prisma from '../src/config/prisma';

async function main() {
  const emps = await prisma.corporateEmployee.findMany({ take: 5 });
  console.log('Sample Corporate Employees:');
  console.log(JSON.stringify(emps, null, 2));

  const equips = await prisma.corporateEquipment.findMany({ take: 5 });
  console.log('Sample Corporate Equipment:');
  console.log(JSON.stringify(equips, null, 2));

  const siteEmps = await prisma.employee.count();
  const siteEqs = await prisma.equipment.count();
  const corpBps = await prisma.corporateBusinessPartner.count();

  console.log(`Site operational records: Employees=${siteEmps}, Equipment=${siteEqs}, Corporate BPs=${corpBps}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
