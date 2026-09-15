import prisma from '../src/config/prisma';
import bcrypt from 'bcrypt';

async function seed531() {
  console.log('🚀 Seeding Project 531M (Walgama Diyagama Road) data...');

  // 1. Ensure Tenant 531M exists
  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { subdomain: '531M' },
        { subdomain: '531' },
      ],
    },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        companyName: 'Walgama Diyagama Road (531M)',
        subdomain: '531M',
        addressLine1: 'Walgama - Diyagama Project Site Office',
        addressLine2: 'Western Province',
        phone: '+94 11 280 8835',
        email: 'site531m@maga.lk',
        status: 'active',
      },
    });
    console.log(`✅ Created Tenant: ${tenant.companyName} (${tenant.subdomain}) - ID: ${tenant.id}`);
  } else {
    console.log(`ℹ️ Existing Tenant found: ${tenant.companyName} (${tenant.subdomain}) - ID: ${tenant.id}`);
  }

  const tenantId = tenant.id;

  // 2. Day Types (needed for time entries & overtime calculations)
  const dayTypes = [
    { name: 'Normal Day', rateMultiplier: 1.0 },
    { name: 'Saturday', rateMultiplier: 1.0 },
    { name: 'Sunday', rateMultiplier: 1.5 },
    { name: 'Shutdown', rateMultiplier: 1.0 },
    { name: 'Public Holiday', rateMultiplier: 2.0 },
  ];

  for (const dt of dayTypes) {
    await prisma.dayType.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: dt.name,
        },
      },
      update: { rateMultiplier: dt.rateMultiplier },
      create: {
        tenantId,
        name: dt.name,
        rateMultiplier: dt.rateMultiplier,
      },
    });
  }
  console.log('✅ Day Types seeded for 531M');

  // 3. Business Partners (1 Internal Maga, 1 External Contractor)
  const internalBp = await prisma.businessPartner.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: 'BP1001001',
      },
    },
    update: {
      name: 'Mäga Engineering (Pvt) Ltd',
      contactPerson: 'Project Manager (531M)',
      phone: '+94 11 2808835',
      status: 'active',
    },
    create: {
      tenantId,
      code: 'BP1001001',
      name: 'Mäga Engineering (Pvt) Ltd',
      contactPerson: 'Project Manager (531M)',
      phone: '+94 11 2808835',
      email: 'info@maga.lk',
      address: '200, Nawala Road, Narahenpita',
      status: 'active',
    },
  });

  const externalBp = await prisma.businessPartner.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: 'BP1004093',
      },
    },
    update: {
      name: 'Aruna Builders (Pvt) Ltd',
      contactPerson: 'Mr. Aruna Wickramasinghe',
      phone: '+94 77 123 4567',
      status: 'active',
    },
    create: {
      tenantId,
      code: 'BP1004093',
      name: 'Aruna Builders (Pvt) Ltd',
      contactPerson: 'Mr. Aruna Wickramasinghe',
      phone: '+94 77 123 4567',
      email: 'arunabuilders@gmail.com',
      address: '15/B, Katuwana Industrial Zone, Homagama',
      status: 'active',
    },
  });

  console.log(`✅ Business Partners seeded:`);
  console.log(`   - Internal: ${internalBp.name} (${internalBp.code})`);
  console.log(`   - External: ${externalBp.name} (${externalBp.code})`);

  // 4. 10 Employees (5 Internal starting with 'H', 5 External starting with 'X')
  const employeesData = [
    // --- 5 Internal Workers (Maga - H codes) ---
    {
      employeeCode: 'H101',
      callingName: 'Kamal',
      fullName: 'Kamal Perera',
      businessPartnerId: internalBp.id,
      tradeGroup: 'Mason',
      nicNo: '198512345678',
      dailyRate: 2200.0,
      epfNo: 'EPF-531-101',
    },
    {
      employeeCode: 'H102',
      callingName: 'Sunil',
      fullName: 'Sunil Shantha',
      businessPartnerId: internalBp.id,
      tradeGroup: 'Carpenter',
      nicNo: '198734567890',
      dailyRate: 2100.0,
      epfNo: 'EPF-531-102',
    },
    {
      employeeCode: 'HK010',
      callingName: 'Nimal',
      fullName: 'Nimal Jayasuriya',
      businessPartnerId: internalBp.id,
      tradeGroup: 'Lab Helper',
      nicNo: '199245678901',
      dailyRate: 1500.0,
      epfNo: 'EPF-531-103',
    },
    {
      employeeCode: 'HK011',
      callingName: 'Ruwan',
      fullName: 'Ruwan Kumara',
      businessPartnerId: internalBp.id,
      tradeGroup: 'Bar Bender',
      nicNo: '199456789012',
      dailyRate: 2000.0,
      epfNo: 'EPF-531-104',
    },
    {
      employeeCode: 'HI105',
      callingName: 'Sarath',
      fullName: 'Sarath Bandara',
      businessPartnerId: internalBp.id,
      tradeGroup: 'Operator',
      nicNo: '198967890123',
      dailyRate: 2400.0,
      epfNo: 'EPF-531-105',
    },

    // --- 5 External Workers (Aruna Builders - X codes) ---
    {
      employeeCode: 'X001',
      callingName: 'Pradeep',
      fullName: 'Pradeep Sanjeewa',
      businessPartnerId: externalBp.id,
      tradeGroup: 'Mason',
      nicNo: '199178901234',
      dailyRate: 1900.0,
      epfNo: '',
    },
    {
      employeeCode: 'X002',
      callingName: 'Anura',
      fullName: 'Anura Kumara',
      businessPartnerId: externalBp.id,
      tradeGroup: 'Painter',
      nicNo: '198889012345',
      dailyRate: 1850.0,
      epfNo: '',
    },
    {
      employeeCode: 'X003',
      callingName: 'Chaminda',
      fullName: 'Chaminda Silva',
      businessPartnerId: externalBp.id,
      tradeGroup: 'Plumber',
      nicNo: '199390123456',
      dailyRate: 2000.0,
      epfNo: '',
    },
    {
      employeeCode: 'X004',
      callingName: 'Kasun',
      fullName: 'Kasun Wijeratne',
      businessPartnerId: externalBp.id,
      tradeGroup: 'Helper',
      nicNo: '200101234567',
      dailyRate: 1400.0,
      epfNo: '',
    },
    {
      employeeCode: 'X005',
      callingName: 'Dilan',
      fullName: 'Dilan Madushanka',
      businessPartnerId: externalBp.id,
      tradeGroup: 'Electrician',
      nicNo: '199612345670',
      dailyRate: 2100.0,
      epfNo: '',
    },
  ];

  for (const emp of employeesData) {
    await prisma.employee.upsert({
      where: {
        tenantId_employeeCode: {
          tenantId,
          employeeCode: emp.employeeCode,
        },
      },
      update: {
        callingName: emp.callingName,
        fullName: emp.fullName,
        businessPartnerId: emp.businessPartnerId,
        tradeGroup: emp.tradeGroup,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo,
        status: 'active',
      },
      create: {
        tenantId,
        employeeCode: emp.employeeCode,
        callingName: emp.callingName,
        fullName: emp.fullName,
        businessPartnerId: emp.businessPartnerId,
        tradeGroup: emp.tradeGroup,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo,
        status: 'active',
      },
    });
  }
  console.log(`✅ Seeded 10 Employees (5 Internal 'H' codes + 5 External 'X' codes)`);

  // 5. 10 Standard Activity Codes
  const activityCodesData = [
    { code: '00-00-11-11-M', description: 'Direct Labour Masonry Works' },
    { code: '01-10-10-00', description: 'Excavation & Earthwork' },
    { code: '01-20-10-00', description: 'Concrete Work - Substructure' },
    { code: '02-10-10-00', description: 'Formwork - Superstructure' },
    { code: '02-20-10-00', description: 'Rebar & Steel Reinforcement' },
    { code: '03-10-10-00', description: 'Masonry Block & Brick Laying' },
    { code: '03-20-10-00', description: 'Plastering Work' },
    { code: '04-10-10-00', description: 'Plumbing & Drainage Work' },
    { code: '04-20-10-00', description: 'Electrical Conduit & Cabling' },
    { code: '05-20-10-00', description: 'Painting & Surface Coating' },
  ];

  for (const ac of activityCodesData) {
    await prisma.activityCode.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: ac.code,
        },
      },
      update: {
        description: ac.description,
      },
      create: {
        tenantId,
        code: ac.code,
        description: ac.description,
      },
    });
  }
  console.log(`✅ Seeded 10 Standard Activity Codes for 531M`);

  // 6. Ensure Admin and Supervisor exist for 531M
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // Admin user
  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId,
        username: 'admin',
      },
    },
    update: {
      status: 'active',
    },
    create: {
      tenantId,
      username: 'admin',
      fullName: 'Site Admin (531M)',
      passwordHash: defaultPasswordHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    },
  });

  // Supervisor user
  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId,
        username: 'supervisor1',
      },
    },
    update: {
      status: 'active',
    },
    create: {
      tenantId,
      username: 'supervisor1',
      fullName: 'Chamara Supervisor',
      passwordHash: defaultPasswordHash,
      role: 'supervisor',
      status: 'active',
      mustChangePassword: false,
    },
  });

  console.log('✅ Created/Verified Admin and Supervisor for 531M (Password: admin123)');
  console.log('🎉 Seeding for 531M completed successfully!');
}

seed531()
  .catch((e) => {
    console.error('❌ Error seeding 531M:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
