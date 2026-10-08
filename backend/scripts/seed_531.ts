import prisma from '../src/config/prisma';
import bcrypt from 'bcrypt';

async function seed531() {
  console.log('🚀 Seeding Project PRJ531 (Walgama Diyagama Road) data...');

  // 1. Ensure Project 531 exists
  let project = await prisma.project.findFirst({
    where: {
      OR: [
        { subdomain: '531' },
        { projectCode: 'PRJ531' },
      ],
    },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        projectCode: 'PRJ531',
        projectName: 'Walgama Diyagama Road (531M)',
        subdomain: '531',
        addressLine1: 'Walgama - Diyagama Project Site Office',
        addressLine2: 'Western Province',
        phone: '+94 11 280 8835',
        email: 'site531m@maga.lk',
        status: 'active',
      },
    });
    console.log(`✅ Created Project: ${project.projectName} (${project.projectCode}) - ID: ${project.id}`);
  } else {
    console.log(`ℹ️ Existing Project found: ${project.projectName} (${project.projectCode}) - ID: ${project.id}`);
  }

  const projectId = project.id;
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // 2. Day Types
  const dayTypes = [
    { code: 'NORMAL', name: 'Normal Day', rateMultiplier: 1.0 },
    { code: 'SATURDAY', name: 'Saturday', rateMultiplier: 1.0 },
    { code: 'SUNDAY', name: 'Sunday', rateMultiplier: 1.5 },
    { code: 'SHUTDOWN', name: 'Shutdown', rateMultiplier: 1.0 },
    { code: 'POYA', name: 'Public Holiday', rateMultiplier: 2.0 },
  ];

  for (const dt of dayTypes) {
    await prisma.dayType.upsert({
      where: { code: dt.code },
      update: { name: dt.name, rateMultiplier: dt.rateMultiplier },
      create: dt,
    });
  }

  // 3. Business Partners
  const internalBp = await prisma.corporateBusinessPartner.upsert({
    where: { code: 'BP1001001' },
    update: { name: 'Mäga Engineering (Pvt) Ltd', currentWorkingProject: 'PRJ531' },
    create: {
      code: 'BP1001001',
      name: 'Mäga Engineering (Pvt) Ltd',
      type: 'internal',
      contactPerson: 'Project Manager (531M)',
      phone: '+94 11 2808835',
      currentWorkingProject: 'PRJ531',
    },
  });

  const externalBp = await prisma.corporateBusinessPartner.upsert({
    where: { code: 'BP1004093' },
    update: { name: 'Aruna Builders (Pvt) Ltd', currentWorkingProject: 'PRJ531' },
    create: {
      code: 'BP1004093',
      name: 'Aruna Builders (Pvt) Ltd',
      type: 'subcontractor',
      contactPerson: 'Mr. Aruna Wickramasinghe',
      phone: '+94 77 123 4567',
      currentWorkingProject: 'PRJ531',
    },
  });

  // 4. Trade Groups
  const masonTg = await prisma.corporateTradeGroup.upsert({
    where: { code: 'MASON' },
    update: {},
    create: { code: 'MASON', name: 'Mason', standardDailyRate: 1750.0 },
  });

  const helperTg = await prisma.corporateTradeGroup.upsert({
    where: { code: 'LABOUR' },
    update: {},
    create: { code: 'LABOUR', name: 'General Helper', standardDailyRate: 1400.0 },
  });

  // 5. Corporate Employees & Site Employees
  const workers = [
    { code: 'H101', name: 'Kamal Perera', tgId: masonTg.id, bpId: internalBp.id, rate: 2200 },
    { code: 'H102', name: 'Sunil Shantha', tgId: masonTg.id, bpId: internalBp.id, rate: 2100 },
    { code: 'HK010', name: 'Nimal Jayasuriya', tgId: helperTg.id, bpId: internalBp.id, rate: 1500 },
    { code: 'X001', name: 'Pradeep Sanjeewa', tgId: masonTg.id, bpId: externalBp.id, rate: 1900 },
    { code: 'X002', name: 'Anura Kumara', tgId: helperTg.id, bpId: externalBp.id, rate: 1850 },
  ];

  for (const w of workers) {
    const corp = await prisma.corporateEmployee.upsert({
      where: { employeeCode: w.code },
      update: {
        fullName: w.name,
        tradeGroupId: w.tgId,
        corporateBusinessPartnerId: w.bpId,
        dailyRate: w.rate,
        currentWorkingProject: 'PRJ531',
      },
      create: {
        employeeCode: w.code,
        fullName: w.name,
        nicNo: `90${Math.floor(Math.random() * 10000000)}V`,
        tradeGroupId: w.tgId,
        corporateBusinessPartnerId: w.bpId,
        dailyRate: w.rate,
        currentWorkingProject: 'PRJ531',
      },
    });

    await prisma.employee.upsert({
      where: {
        projectId_corporateEmployeeId: {
          projectId,
          corporateEmployeeId: corp.id,
        },
      },
      update: {
        callingName: w.name.split(' ')[0],
        dailyRate: w.rate,
        tradeGroupId: w.tgId,
        businessPartnerId: w.bpId,
        status: 'active',
      },
      create: {
        projectId,
        corporateEmployeeId: corp.id,
        callingName: w.name.split(' ')[0],
        dailyRate: w.rate,
        tradeGroupId: w.tgId,
        businessPartnerId: w.bpId,
        status: 'active',
      },
    });
  }

  // 6. Users
  await prisma.user.upsert({
    where: {
      projectId_username: {
        projectId,
        username: 'admin',
      },
    },
    update: { status: 'active' },
    create: {
      projectId,
      username: 'admin',
      fullName: 'Site Admin (531M)',
      passwordHash: defaultPasswordHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: {
      projectId_username: {
        projectId,
        username: 'supervisor1',
      },
    },
    update: { status: 'active' },
    create: {
      projectId,
      username: 'supervisor1',
      fullName: 'Chamara Supervisor',
      passwordHash: defaultPasswordHash,
      role: 'supervisor',
      status: 'active',
      mustChangePassword: false,
    },
  });

  console.log('✅ Site PRJ531 seeded cleanly with schema-compliant data!');
}

seed531()
  .catch((e) => {
    console.error('❌ Error seeding 531M:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
