import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Comprehensive Database Seeding for Mäga Construction Enterprise...');

  // Default secure password hash for testing / demo: "admin123"
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. SUPER ADMIN (Central Head Office IT)
  // ─────────────────────────────────────────────────────────────────────────
  const superAdmin = await prisma.mF_G_SuperAdmin.upsert({
    where: { username: 'superadmin' },
    update: {
      fullName: 'Mäga Central Super Administrator',
      passwordHash: defaultPasswordHash,
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
  console.log(`✅ Super Admin seeded: ${superAdmin.username}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. UNIFIED PROJECTS (Merged CorporateProject + Tenant)
  // ─────────────────────────────────────────────────────────────────────────
  const projectsData = [
    {
      projectCode: 'PRJ001',
      projectName: 'Mäga Engineering (Head Office)',
      subdomain: 'maga',
      addressLine1: '200, Nawala Road',
      addressLine2: 'Narahenpita, Colombo 05',
      phone: '+94 11 2808835',
      email: 'info@maga.lk',
      status: 'active',
    },
    {
      projectCode: 'PRJ531',
      projectName: 'Walgama Diyagama Road (531M)',
      subdomain: '531',
      addressLine1: 'Walgama - Diyagama Project Site Office',
      addressLine2: 'Western Province',
      phone: '+94 11 280 8835',
      email: 'site531m@maga.lk',
      status: 'active',
    },
    {
      projectCode: 'PRJ521',
      projectName: 'Kandy Road Rehabilitation (521M)',
      subdomain: '521',
      addressLine1: 'Kandy Road Site Office',
      addressLine2: 'Central Province',
      phone: '+94 81 223 4567',
      email: 'site521m@maga.lk',
      status: 'active',
    },
    {
      projectCode: 'PRJ403',
      projectName: 'SEEP Project Base (403M)',
      subdomain: '403',
      addressLine1: 'M00000403 Site Base',
      addressLine2: 'Colombo',
      phone: '+94 11 255 1234',
      email: 'seep403m@maga.lk',
      status: 'active',
    },
  ];

  const projectMap: Record<string, string> = {};
  for (const p of projectsData) {
    const record = await prisma.mF_P_Project.upsert({
      where: { projectCode: p.projectCode },
      update: {
        projectName: p.projectName,
        subdomain: p.subdomain,
        addressLine1: p.addressLine1,
        addressLine2: p.addressLine2,
        phone: p.phone,
        email: p.email,
        status: p.status,
      },
      create: p,
    });
    projectMap[p.subdomain] = record.id;
    projectMap[p.projectCode] = record.id;
  }
  const defaultProjectId = projectMap['531'] || projectMap['maga'];
  console.log(`✅ Projects seeded (${projectsData.length} active sites)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. GLOBAL DAY TYPES (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const dayTypesData = [
    { code: 'NORMAL', name: 'Normal Day', rateMultiplier: 1.0 },
    { code: 'SATURDAY', name: 'Saturday', rateMultiplier: 1.0 },
    { code: 'SUNDAY', name: 'Sunday', rateMultiplier: 1.5 },
    { code: 'SHUTDOWN', name: 'Shutdown', rateMultiplier: 1.0 },
    { code: 'POYA', name: 'Public Holiday', rateMultiplier: 2.0 },
  ];

  const dayTypeMap: Record<string, string> = {};
  for (const dt of dayTypesData) {
    const record = await prisma.mF_G_DayType.upsert({
      where: { code: dt.code },
      update: { name: dt.name, rateMultiplier: dt.rateMultiplier },
      create: dt,
    });
    dayTypeMap[dt.code] = record.id;
    dayTypeMap[dt.name] = record.id;
  }
  console.log(`✅ Global Day Types seeded (${dayTypesData.length} types)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. GLOBAL UNIT MASTERS (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const unitsData = [
    { code: 'Hrs', name: 'Running Hours', category: 'meter' },
    { code: 'Days', name: 'Daily Utilization', category: 'day' },
    { code: 'mth', name: 'Monthly Calendar', category: 'month' },
    { code: 'km', name: 'Kilometers Mileage', category: 'mileage' },
    { code: 'EX.hrs', name: 'Excavation Extra Hours', category: 'meter' },
    { code: 'ton', name: 'Metric Tonne Capacity', category: 'weight' },
  ];

  for (const u of unitsData) {
    await prisma.mF_G_UnitMaster.upsert({
      where: { code: u.code },
      update: { name: u.name, category: u.category },
      create: u,
    });
  }
  console.log(`✅ Unit Masters seeded (${unitsData.length} units)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. GLOBAL TRADE GROUPS (Level 1 Master) — 78 Official Construction Trades
  // ─────────────────────────────────────────────────────────────────────────
  const tradeGroupsData = [
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

  const tradeGroupMap: Record<string, string> = {};
  for (const tg of tradeGroupsData) {
    const record = await prisma.mF_G_TradeGroup.upsert({
      where: { code: tg.code },
      update: {
        name: tg.name,
        standardDailyRate: tg.standardDailyRate,
        standardOtRate: tg.standardOtRate,
      },
      create: tg,
    });
    tradeGroupMap[tg.code] = record.id;
    tradeGroupMap[tg.name.toLowerCase()] = record.id;
  }

  // Legacy fallback aliases for mock employee records
  tradeGroupMap['DRIVER'] = tradeGroupMap['MDR'] || tradeGroupMap['MDH'];
  tradeGroupMap['MASON'] = tradeGroupMap['MMS'];
  tradeGroupMap['OPERATOR'] = tradeGroupMap['MOP'] || tradeGroupMap['MOL'];
  tradeGroupMap['CARPENTER'] = tradeGroupMap['MCP'];
  tradeGroupMap['LABOUR'] = tradeGroupMap['MUS'] || tradeGroupMap['MBL'];
  tradeGroupMap['STORES'] = tradeGroupMap['MHT'];
  tradeGroupMap['ELECTRICIAN'] = tradeGroupMap['MEL'];
  tradeGroupMap['WELDER'] = tradeGroupMap['MWL'];
  tradeGroupMap['PLUMBER'] = tradeGroupMap['MPL'];
  tradeGroupMap['CHARGE_HAND'] = tradeGroupMap['SSK'];

  console.log(`✅ Trade Groups seeded (${tradeGroupsData.length} trade groups)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. GLOBAL BUSINESS PARTNERS (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const businessPartnersData = [
    {
      code: 'BP1002885',
      name: 'Mäga Engineering (Pvt) Ltd',
      type: 'internal',
      contactPerson: 'Central HR Operations',
      phone: '011-2808835',
      email: 'labour@maga.lk',
    },
    {
      code: 'BP1004093',
      name: 'Aruna Builders (Pvt) Ltd',
      type: 'subcontractor',
      contactPerson: 'Mr. Aruna Jayawardena',
      phone: '077-1234567',
      email: 'info@arunabuilders.lk',
    },
    {
      code: 'BP1020469',
      name: 'Vanitha S Manpower Supply',
      type: 'subcontractor',
      contactPerson: 'Vanitha S',
      phone: '077-5767921',
      email: 'vanitha.manpower@gmail.com',
    },
    {
      code: 'BP1016329',
      name: 'Arumugam Pillai Nagarajah Manpower Supply',
      type: 'subcontractor',
      contactPerson: 'Arumugam Pillai Nagarajah',
      phone: '077-4557850',
      email: 'arumugam.manpower@gmail.com',
    },
    {
      code: 'BP1020897',
      name: 'Pathmanathan Gnanendra Manpower Supply',
      type: 'subcontractor',
      contactPerson: 'Pathmanathan Gnanendra',
      phone: '077-9998255',
      email: 'pathmanathan.manpower@gmail.com',
    },
  ];

  const bpMap: Record<string, string> = {};
  for (const bp of businessPartnersData) {
    const record = await prisma.mF_G_BusinessPartner.upsert({
      where: { code: bp.code },
      update: {
        name: bp.name,
        type: bp.type,
        contactPerson: bp.contactPerson,
        phone: bp.phone,
        email: bp.email,
      },
      create: bp,
    });
    bpMap[bp.code] = record.id;
    bpMap[bp.name.toLowerCase()] = record.id;
  }
  console.log(`✅ Business Partners seeded (${businessPartnersData.length} corporate partners)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. GLOBAL ACTIVITY CODES (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const activityCodesData = [
    { code: '00-00-10-00', description: 'Other site over head', unit: 'Days' },
    { code: '00-00-11-11-M', description: 'Direct Labour Masonry Works', unit: 'hrs' },
    { code: '00-00-11-13', description: 'Welfare Facilities - Meals and Tea - for Contractor', unit: 'Nos' },
    { code: '00-00-11-30', description: 'Salaries and Wages - for Contractor', unit: 'mth' },
    { code: '00-00-20-10', description: 'Dayworks - Labour', unit: 'hrs' },
    { code: '00-00-20-20', description: 'Dayworks - Equipment', unit: 'hrs' },
    { code: '00-00-20-30', description: 'Dayworks - Materials', unit: 'Nos' },
    { code: '00-00-50-00', description: 'Head office Overhead', unit: 'L.S' },
    { code: '01-10-10-00', description: 'Excavation & Earthwork', unit: 'm3' },
    { code: '01-20-10-00', description: 'Concrete Work - Substructure', unit: 'm3' },
    { code: '02-10-10-00', description: 'Formwork - Superstructure', unit: 'm2' },
    { code: '02-20-10-00', description: 'Rebar & Steel Reinforcement', unit: 'Kg' },
    { code: '03-10-10-00', description: 'Masonry Block & Brick Laying', unit: 'm2' },
    { code: '03-20-10-00', description: 'Plastering Work', unit: 'm2' },
    { code: '04-10-10-00', description: 'Plumbing & Drainage Work', unit: 'm' },
    { code: '04-20-10-00', description: 'Electrical Conduit & Cabling', unit: 'm' },
    { code: '05-10-10-00', description: 'Tile Laying & Finishes', unit: 'm2' },
    { code: '05-20-10-00', description: 'Painting & Surface Coating', unit: 'm2' },
    { code: '06-10-10-00', description: 'Welding & Structural Steel', unit: 'Kg' },
  ];

  const corpActivityCodeMap: Record<string, string> = {};
  for (const ac of activityCodesData) {
    const record = await prisma.mF_G_ActivityCode.upsert({
      where: { code: ac.code },
      update: { description: ac.description, unit: ac.unit },
      create: ac,
    });
    corpActivityCodeMap[ac.code] = record.id;
  }
  console.log(`✅ Global Activity Codes seeded (${activityCodesData.length} master codes)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 8. GLOBAL CORPORATE EQUIPMENT (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const corporateEquipmentData = [
    {
      standardEquipmentNumber: 'MACM0075',
      equipmentName: 'AIR COMPRESSOR INGERSOLL RAND',
      vehicleNo: 'WP-QA-1001',
      unit: 'Hrs',
      condition: 'DRY',
      dailyRate: 12500.0,
      costRate: 11000.0,
      type: 'Air compressor',
    },
    {
      standardEquipmentNumber: 'MEXC0012',
      equipmentName: 'EXCAVATOR CAT 320D',
      vehicleNo: 'WP-QA-2002',
      unit: 'Hrs',
      condition: 'DRY',
      dailyRate: 45000.0,
      costRate: 40000.0,
      type: 'Heavy machinery',
    },
    {
      standardEquipmentNumber: 'MJCB0034',
      equipmentName: 'BACKHOE LOADER JCB 3CX',
      vehicleNo: 'WP-QA-3003',
      unit: 'Hrs',
      condition: 'DRY',
      dailyRate: 35000.0,
      costRate: 30000.0,
      type: 'Heavy machinery',
    },
    {
      standardEquipmentNumber: 'MROL0042',
      equipmentName: 'COMPACTOR ROLLER BOMAG 8T',
      vehicleNo: 'WP-QA-4004',
      unit: 'Hrs',
      condition: 'DRY',
      dailyRate: 28000.0,
      costRate: 25000.0,
      type: 'Compaction',
    },
    {
      standardEquipmentNumber: 'MMIX0025',
      equipmentName: 'CONCRETE MIXER 350L',
      vehicleNo: 'WP-QA-5005',
      unit: 'Days',
      condition: 'DRY',
      dailyRate: 6500.0,
      costRate: 5500.0,
      type: 'Concrete',
    },
    {
      standardEquipmentNumber: 'MTRK0056',
      equipmentName: 'DUMP TRUCK ISUZU 10T',
      vehicleNo: 'WP-LD-6006',
      unit: 'km',
      condition: 'DRY',
      dailyRate: 18000.0,
      costRate: 16000.0,
      type: 'Transport',
    },
  ];

  const corpEquipMap: Record<string, string> = {};
  for (const eq of corporateEquipmentData) {
    const existing = await prisma.mF_G_Equipment.findFirst({
      where: { standardEquipmentNumber: eq.standardEquipmentNumber },
    });
    if (existing) {
      corpEquipMap[eq.standardEquipmentNumber] = existing.id;
    } else {
      const created = await prisma.mF_G_Equipment.create({
        data: eq,
      });
      corpEquipMap[eq.standardEquipmentNumber] = created.id;
    }
  }
  console.log(`✅ Corporate Equipment seeded (${corporateEquipmentData.length} machines)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 9. GLOBAL CORPORATE EMPLOYEES (Level 1 Master)
  // ─────────────────────────────────────────────────────────────────────────
  const corporateEmployeesData = [
    // Operators / Drivers
    {
      employeeCode: 'R8184',
      fullName: 'Piyasena PWM',
      nicNo: '921530170V',
      dailyRate: 1500.0,
      isOperator: true,
      tradeGroupCode: 'DRIVER',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'R8562',
      fullName: 'Vipula RA',
      nicNo: '672970342V',
      dailyRate: 1550.0,
      epfNo: '74493',
      isOperator: true,
      tradeGroupCode: 'DRIVER',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'R8609',
      fullName: 'Janaka HA',
      nicNo: '791143748V',
      dailyRate: 1650.0,
      epfNo: '74697',
      isOperator: true,
      tradeGroupCode: 'OPERATOR',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'R6404',
      fullName: 'Kumara PMRJP',
      nicNo: '973332457V',
      dailyRate: 1750.0,
      epfNo: '57635',
      isOperator: true,
      tradeGroupCode: 'OPERATOR',
      bpCode: 'BP1002885',
    },

    // Labour / Trades
    {
      employeeCode: 'HK357',
      fullName: 'Piyarathne B',
      nicNo: '196135402540',
      dailyRate: 1750.0,
      epfNo: '19795',
      isOperator: false,
      tradeGroupCode: 'MASON',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'HK358',
      fullName: 'Abesinghe KA',
      nicNo: '196108002761',
      dailyRate: 1600.0,
      epfNo: '72688',
      isOperator: false,
      tradeGroupCode: 'MASON',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'HK360',
      fullName: 'Bandara KMT',
      nicNo: '196621203617',
      dailyRate: 1750.0,
      epfNo: '74654',
      isOperator: false,
      tradeGroupCode: 'CARPENTER',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'HK362',
      fullName: 'Jayasooriya EPSU',
      nicNo: '200309010217',
      dailyRate: 1400.0,
      epfNo: '74202',
      isOperator: false,
      tradeGroupCode: 'STORES',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'HK369',
      fullName: 'Indrasena KGG',
      nicNo: '582442061V',
      dailyRate: 1400.0,
      isOperator: false,
      tradeGroupCode: 'LABOUR',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'HK370',
      fullName: 'Wickramasinghe DAS',
      nicNo: '198012803306',
      dailyRate: 1400.0,
      isOperator: false,
      tradeGroupCode: 'LABOUR',
      bpCode: 'BP1002885',
    },
    {
      employeeCode: 'X51265',
      fullName: 'Thilakshan P',
      nicNo: '983222714V',
      dailyRate: 1840.0,
      isOperator: false,
      tradeGroupCode: 'LABOUR',
      bpCode: 'BP1020469',
    },
    {
      employeeCode: 'X51266',
      fullName: 'Prajanth MC',
      nicNo: '802101538V',
      dailyRate: 1840.0,
      isOperator: false,
      tradeGroupCode: 'LABOUR',
      bpCode: 'BP1020469',
    },
    {
      employeeCode: 'X48344',
      fullName: 'Chandralal KGWK',
      nicNo: '197522700970',
      dailyRate: 2040.0,
      isOperator: false,
      tradeGroupCode: 'MASON',
      bpCode: 'BP1016329',
    },
  ];

  const corpEmpMap: Record<string, string> = {};
  for (const emp of corporateEmployeesData) {
    const record = await prisma.mF_G_Employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {
        fullName: emp.fullName,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo || null,
        isOperator: emp.isOperator,
        employeeType: bpMap[emp.bpCode] ? 'external' : 'internal',
        tradeGroupId: tradeGroupMap[emp.tradeGroupCode],
        corporateBusinessPartnerId: bpMap[emp.bpCode],
        currentWorkingProject: 'PRJ531',
      },
      create: {
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo || null,
        isOperator: emp.isOperator,
        employeeType: bpMap[emp.bpCode] ? 'external' : 'internal',
        tradeGroupId: tradeGroupMap[emp.tradeGroupCode],
        corporateBusinessPartnerId: bpMap[emp.bpCode],
        currentWorkingProject: 'PRJ531',
      },
    });
    corpEmpMap[emp.employeeCode] = record.id;
  }
  console.log(`✅ Corporate Employees seeded (${corporateEmployeesData.length} records)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 10. PROJECT OPERATIONAL SETUP (FOR PRJ531 SITE)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🏗️ Deploying operational site master data for PRJ531 (Walgama Diyagama)...');

  // A. Site Users (Admin & Supervisors)
  const systemUsers = [
    {
      username: 'admin',
      fullName: 'Project Administrator (531M)',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      username: 'supervisor1',
      fullName: 'Ruwan Jayasinghe (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      username: 'supervisor2',
      fullName: 'Chaminda Wijesekara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      username: 'supervisor3',
      fullName: 'Nimal Bandara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
  ];

  const userMap: Record<string, string> = {};
  for (const u of systemUsers) {
    const record = await prisma.mF_P_User.upsert({
      where: {
        projectId_username: {
          projectId: defaultProjectId,
          username: u.username,
        },
      },
      update: {
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
      },
      create: {
        projectId: defaultProjectId,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
        mustChangePassword: u.mustChangePassword,
      },
    });
    userMap[u.username] = record.id;
  }
  console.log(`✅ Site Users seeded (${systemUsers.length} users with password 'admin123')`);

  // B. Site Activity Codes (Linked to PRJ531)
  const siteActivityMap: Record<string, string> = {};
  for (const ac of activityCodesData) {
    const record = await prisma.mF_P_ActivityCode.upsert({
      where: {
        projectId_code: {
          projectId: defaultProjectId,
          code: ac.code,
        },
      },
      update: {
        description: ac.description,
        corporateActivityCodeId: corpActivityCodeMap[ac.code],
      },
      create: {
        projectId: defaultProjectId,
        code: ac.code,
        description: ac.description,
        corporateActivityCodeId: corpActivityCodeMap[ac.code],
      },
    });
    siteActivityMap[ac.code] = record.id;
  }

  // C. Site Employees (Linked to Corporate Employees)
  const siteEmpMap: Record<string, string> = {};
  for (const emp of corporateEmployeesData) {
    const corpId = corpEmpMap[emp.employeeCode];
    const record = await prisma.mF_P_Employee.upsert({
      where: {
        projectId_corporateEmployeeId: {
          projectId: defaultProjectId,
          corporateEmployeeId: corpId,
        },
      },
      update: {
        callingName: emp.fullName.split(' ')[0],
        dailyRate: emp.dailyRate,
        isOperator: emp.isOperator,
        tradeGroupId: tradeGroupMap[emp.tradeGroupCode],
        businessPartnerId: bpMap[emp.bpCode],
        status: 'active',
      },
      create: {
        projectId: defaultProjectId,
        corporateEmployeeId: corpId,
        callingName: emp.fullName.split(' ')[0],
        dailyRate: emp.dailyRate,
        isOperator: emp.isOperator,
        tradeGroupId: tradeGroupMap[emp.tradeGroupCode],
        businessPartnerId: bpMap[emp.bpCode],
        status: 'active',
      },
    });
    siteEmpMap[emp.employeeCode] = record.id;
  }
  console.log(`✅ Site Employees deployed (${Object.keys(siteEmpMap).length} workers)`);

  // D. Site Equipment (Linked to Corporate Machinery)
  const siteEquipMap: Record<string, string> = {};
  for (const eq of corporateEquipmentData) {
    const corpEqId = corpEquipMap[eq.standardEquipmentNumber];
    const record = await prisma.mF_P_Equipment.upsert({
      where: {
        projectId_corporateEquipmentId: {
          projectId: defaultProjectId,
          corporateEquipmentId: corpEqId,
        },
      },
      update: {
        condition: eq.condition,
        costRate: eq.costRate,
        meterUnitCode: eq.unit,
        status: 'active',
      },
      create: {
        projectId: defaultProjectId,
        corporateEquipmentId: corpEqId,
        condition: eq.condition,
        costRate: eq.costRate,
        meterUnitCode: eq.unit,
        status: 'active',
      },
    });
    siteEquipMap[eq.standardEquipmentNumber] = record.id;
  }
  console.log(`✅ Site Equipment deployed (${Object.keys(siteEquipMap).length} machines)`);

  // E. Site Calendar Days
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month, d));
    const dow = dateObj.getUTCDay();

    let targetDayTypeId = dayTypeMap['NORMAL'];
    let remarks: string | null = null;

    if (dow === 0) {
      targetDayTypeId = dayTypeMap['SUNDAY'];
      remarks = 'Weekly Sunday Rest (Full OT)';
    } else if (dow === 6) {
      targetDayTypeId = dayTypeMap['SATURDAY'];
      remarks = 'Saturday Half Day (OT after 1 PM)';
    } else if (d === 15) {
      targetDayTypeId = dayTypeMap['POYA'];
      remarks = 'Poya / Public Holiday (Full OT)';
    }

    await prisma.mF_P_CalendarDay.upsert({
      where: {
        projectId_date: {
          projectId: defaultProjectId,
          date: dateObj,
        },
      },
      update: { dayTypeId: targetDayTypeId, remarks },
      create: {
        projectId: defaultProjectId,
        date: dateObj,
        dayTypeId: targetDayTypeId,
        remarks,
      },
    });
  }
  console.log(`✅ Site Calendar Days seeded for current month (${daysInMonth} days)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 11. DAILY OPERATIONAL SHEETS, ASSIGNMENTS & TIME ENTRIES
  // ─────────────────────────────────────────────────────────────────────────
  const sup1Id = userMap['supervisor1'];
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterdayUtc = new Date(todayUtc.getTime() - 86400000);

  // Create DailySheet for Supervisor 1 on Yesterday
  const yesterdaySheet = await prisma.mF_OP_DailySheet.upsert({
    where: {
      projectId_supervisorId_date: {
        projectId: defaultProjectId,
        supervisorId: sup1Id,
        date: yesterdayUtc,
      },
    },
    update: {
      status: 'approved',
      siteCode: 'PRJ531',
    },
    create: {
      projectId: defaultProjectId,
      supervisorId: sup1Id,
      date: yesterdayUtc,
      siteCode: 'PRJ531',
      status: 'approved',
    },
  });

  // Assign Labour to Supervisor 1
  const assignedCodes = ['HK357', 'HK358', 'HK360', 'HK369', 'X51265'];
  for (const code of assignedCodes) {
    const empId = siteEmpMap[code];
    if (empId) {
      await prisma.mF_OP_DailyAssignment.upsert({
        where: {
          dailySheetId_employeeId: {
            dailySheetId: yesterdaySheet.id,
            employeeId: empId,
          },
        },
        update: { isStandby: false },
        create: {
          dailySheetId: yesterdaySheet.id,
          employeeId: empId,
          isStandby: false,
        },
      });
    }
  }

  // Equipment Assignment: Operator R8609 with Backhoe MJCB0034
  const opEmpId = siteEmpMap['R8609'];
  const backhoeId = siteEquipMap['MJCB0034'];
  if (opEmpId && backhoeId) {
    const eqAssign = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
      where: {
        dailySheetId_equipmentId: {
          dailySheetId: yesterdaySheet.id,
          equipmentId: backhoeId,
        },
      },
      update: {
        operatorId: opEmpId,
      },
      create: {
        dailySheetId: yesterdaySheet.id,
        operatorId: opEmpId,
        equipmentId: backhoeId,
      },
    });

    // Create Equipment Daily Log
    await prisma.mF_OP_EquipmentDailyLog.upsert({
      where: { assignmentId: eqAssign.id },
      update: {
        initialMeter: 1240.5,
        finalMeter: 1248.5,
        netRunningHours: 8.0,
        workingHours: 7.5,
        idleHours: 0.5,
        fuelLiters: 45.0,
        status: 'approved',
      },
      create: {
        assignmentId: eqAssign.id,
        unitCode: 'Hrs',
        initialMeter: 1240.5,
        finalMeter: 1248.5,
        netRunningHours: 8.0,
        workingHours: 7.5,
        idleHours: 0.5,
        fuelLiters: 45.0,
        status: 'approved',
      },
    });
  }

  // Time Entries for Labour with Overtime
  const masonryActId = siteActivityMap['00-00-11-11-M'] || Object.values(siteActivityMap)[0];
  const earthActId = siteActivityMap['01-10-10-00'] || Object.values(siteActivityMap)[1];

  const sampleEntries = [
    {
      empCode: 'HK357',
      actId: masonryActId,
      inTime: '07:00',
      outTime: '17:30',
      hours: 9.5,
      otHours: 1.5,
      remarks: 'Masonry column casting',
    },
    {
      empCode: 'HK358',
      actId: masonryActId,
      inTime: '07:00',
      outTime: '17:00',
      hours: 9.0,
      otHours: 1.0,
      remarks: 'Masonry assistance & scaffolding',
    },
    {
      empCode: 'HK360',
      actId: earthActId,
      inTime: '07:00',
      outTime: '19:00',
      hours: 11.0,
      otHours: 3.0,
      remarks: 'Formwork shuttering',
    },
    {
      empCode: 'X51265',
      actId: earthActId,
      inTime: '07:00',
      outTime: '16:00',
      hours: 8.0,
      otHours: 0.0,
      remarks: 'Subcontractor site leveling',
    },
  ];

  for (const entry of sampleEntries) {
    const empId = siteEmpMap[entry.empCode];
    if (empId) {
      const existing = await prisma.mF_OP_TimeEntry.findFirst({
        where: {
          projectId: defaultProjectId,
          employeeId: empId,
          date: yesterdayUtc,
          activityId: entry.actId,
        },
      });

      if (existing) {
        await prisma.mF_OP_TimeEntry.update({
          where: { id: existing.id },
          data: {
            inTime: entry.inTime,
            outTime: entry.outTime,
            hours: entry.hours,
            overtimeHours: entry.otHours,
            shiftHours: entry.hours,
            status: 'approved',
            remarks: entry.remarks,
          },
        });
      } else {
        await prisma.mF_OP_TimeEntry.create({
          data: {
            projectId: defaultProjectId,
            dailySheetId: yesterdaySheet.id,
            employeeId: empId,
            activityId: entry.actId,
            effectiveDayTypeId: dayTypeMap['NORMAL'],
            recordedById: sup1Id,
            date: yesterdayUtc,
            inTime: entry.inTime,
            outTime: entry.outTime,
            hours: entry.hours,
            overtimeHours: entry.otHours,
            shiftHours: entry.hours,
            status: 'approved',
            remarks: entry.remarks,
          },
        });
      }
    }
  }

  console.log('✅ Daily sheets, machinery logs & attendance time entries seeded successfully');
  console.log('🎉 Database seeding completed successfully! All data conforms to the new schema.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
