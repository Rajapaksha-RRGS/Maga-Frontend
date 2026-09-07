import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Neon PostgreSQL Database for Mäga Engineering SaaS...');

  // 1. Create or ensure Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'maga' },
    update: {},
    create: {
      companyName: 'Mäga Engineering (Pvt) Ltd',
      subdomain: 'maga',
      addressLine1: '200, Nawala Road',
      addressLine2: 'Narahenpita, Colombo 05',
      phone: '+94 11 2808835',
      email: 'info@maga.lk',
      status: 'active',
    },
  });
  console.log(`✅ Tenant: ${tenant.companyName} (${tenant.id})`);

  // 2. Day Types
  const dayTypes = [
    { name: 'Normal Day', rateMultiplier: 1.0 },
    { name: 'Sunday', rateMultiplier: 1.5 },
    { name: 'Poya', rateMultiplier: 1.5 },
    { name: 'Public Holiday', rateMultiplier: 2.0 },
  ];

  for (const dt of dayTypes) {
    await prisma.dayType.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: dt.name,
        },
      },
      update: { rateMultiplier: dt.rateMultiplier },
      create: {
        tenantId: tenant.id,
        name: dt.name,
        rateMultiplier: dt.rateMultiplier,
      },
    });
  }
  console.log('✅ Day Types seeded');

  // 3. Business Partners (BP1xxxxxx standard)
  const businessPartners = [
    {
      code: 'BP1004093',
      name: 'Aruna Builders (Pvt) Ltd',
      contactPerson: 'Mr. Aruna Jayawardena',
      phone: '+94 77 123 4567',
      email: 'info@arunabuilders.lk',
      address: 'No. 45, Galle Road, Kalutara',
    },
    {
      code: 'BP1001001',
      name: 'Maga Engineering (Direct Labour)',
      contactPerson: 'HR Operations',
      phone: '+94 11 2808835',
      email: 'labour@maga.lk',
      address: '200, Nawala Road, Colombo 05',
    },
    {
      code: 'BP1002004',
      name: 'Laksiri Construction',
      contactPerson: 'Mr. Laksiri Wickramasinghe',
      phone: '+94 71 987 6543',
      email: 'laksiri.build@gmail.com',
      address: '12/A, Kandy Road, Kadawatha',
    },
    {
      code: 'BP1003012',
      name: 'Gamini Enterprises',
      contactPerson: 'Mr. Gamini Dissanayake',
      phone: '+94 76 555 1212',
      email: 'gamini.ent@sltnet.lk',
      address: '88, Highlevel Road, Maharagama',
    },
  ];

  const createdPartners: Record<string, string> = {};
  for (const bp of businessPartners) {
    const partner = await prisma.businessPartner.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: bp.code,
        },
      },
      update: {
        name: bp.name,
        contactPerson: bp.contactPerson,
        phone: bp.phone,
        email: bp.email,
        address: bp.address,
      },
      create: {
        tenantId: tenant.id,
        code: bp.code,
        name: bp.name,
        contactPerson: bp.contactPerson,
        phone: bp.phone,
        email: bp.email,
        address: bp.address,
      },
    });
    createdPartners[bp.code] = partner.id;
  }
  console.log('✅ Business Partners seeded');

  // 4. Activity Codes (ERP Compatible)
  const activityCodes = [
    { code: '00-00-11-11-M', description: 'Direct Labour Masonry Works' },
    { code: '01-10-10-00', description: 'Earth Work Excavation & Trenching' },
    { code: '02-20-10-00', description: 'Concrete Pouring & Compaction' },
    { code: '03-30-10-00', description: 'Formwork & Shuttering Installation' },
    { code: '04-40-10-00', description: 'Reinforcement Steel Bar Bending & Fixing' },
  ];

  for (const ac of activityCodes) {
    await prisma.activityCode.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: ac.code,
        },
      },
      update: { description: ac.description },
      create: {
        tenantId: tenant.id,
        code: ac.code,
        description: ac.description,
      },
    });
  }
  console.log('✅ Activity Codes seeded');

  // 5. Equipment
  const equipmentList = [
    { code: 'EQ-01', name: 'Concrete Mixer 400L', type: 'Mixer' },
    { code: 'EQ-02', name: 'Poker Vibrator (Petrol)', type: 'Compactor' },
    { code: 'EQ-03', name: 'Rebar Cutter Machine', type: 'Cutting' },
  ];

  for (const eq of equipmentList) {
    await prisma.equipment.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: eq.code,
        },
      },
      update: { name: eq.name, type: eq.type },
      create: {
        tenantId: tenant.id,
        code: eq.code,
        name: eq.name,
        type: eq.type,
      },
    });
  }
  console.log('✅ Equipment seeded');

  // 6. Employees (Labour Master List)
  const employees = [
    {
      employeeCode: 'HK030',
      callingName: 'Kamal Perera',
      fullName: 'Kamal Upali Perera',
      tradeGroup: 'Mason',
      nicNo: '198512345678',
      dailyRate: 1600.0,
      epfNo: 'EPF-9021',
      partnerCode: 'BP1004093',
    },
    {
      employeeCode: 'HK031',
      callingName: 'Nimal Silva',
      fullName: 'Nimal Jayatissa Silva',
      tradeGroup: 'Carpenter',
      nicNo: '198823456789',
      dailyRate: 1550.0,
      epfNo: 'EPF-9022',
      partnerCode: 'BP1004093',
    },
    {
      employeeCode: 'HI101',
      callingName: 'Sunil Shantha',
      fullName: 'Sunil Shantha Kumarage',
      tradeGroup: 'Bar Bender',
      nicNo: '199034567890',
      dailyRate: 1500.0,
      epfNo: 'EPF-8812',
      partnerCode: 'BP1001001',
    },
    {
      employeeCode: 'HI102',
      callingName: 'Chaminda Bandara',
      fullName: 'Chaminda Susantha Bandara',
      tradeGroup: 'General labour',
      nicNo: '199245678901',
      dailyRate: 1400.0,
      epfNo: '',
      partnerCode: 'BP1002004',
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: {
        tenantId_employeeCode: {
          tenantId: tenant.id,
          employeeCode: emp.employeeCode,
        },
      },
      update: {
        callingName: emp.callingName,
        fullName: emp.fullName,
        tradeGroup: emp.tradeGroup,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo,
        businessPartnerId: createdPartners[emp.partnerCode],
      },
      create: {
        tenantId: tenant.id,
        employeeCode: emp.employeeCode,
        callingName: emp.callingName,
        fullName: emp.fullName,
        tradeGroup: emp.tradeGroup,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo,
        businessPartnerId: createdPartners[emp.partnerCode],
      },
    });
  }
  console.log('✅ Employees seeded');

  // 7. Users (Admin and Site Supervisors with Login credentials)
  const systemUsers = [
    {
      username: 'admin',
      fullName: 'System Administrator',
      role: 'admin',
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // admin123
      mustChangePassword: false,
    },
    {
      username: 'supervisor1',
      fullName: 'Ruwan Jayasinghe (Site Supervisor)',
      role: 'supervisor',
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // sup123
      mustChangePassword: false,
    },
    {
      username: 'supervisor2',
      fullName: 'Chaminda Wijesekara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
      mustChangePassword: false,
    },
    {
      username: 'supervisor3',
      fullName: 'Nimal Bandara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
      mustChangePassword: false,
    },
  ];

  for (const u of systemUsers) {
    await prisma.user.upsert({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username: u.username,
        },
      },
      update: {
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
      },
      create: {
        tenantId: tenant.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
        mustChangePassword: u.mustChangePassword,
      },
    });
  }
  console.log('✅ Admin & Supervisor Users seeded');

  console.log('✨ Neon PostgreSQL Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
