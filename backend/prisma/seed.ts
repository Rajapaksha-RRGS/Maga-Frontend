import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding for Mäga Engineering SaaS...');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. TENANTS (Multi-Tenant Organizations)
  // ─────────────────────────────────────────────────────────────────────────
  const tenantsData = [
    {
      subdomain: 'maga',
      companyName: 'Mäga Engineering (Pvt) Ltd',
      addressLine1: '200, Nawala Road',
      addressLine2: 'Narahenpita, Colombo 05',
      phone: '+94 11 2808835',
      email: 'info@maga.lk',
      status: 'active',
    },
    {
      subdomain: '531M',
      companyName: 'Walgama Diyagama Road',
      addressLine1: 'Walgama - Diyagama Project Site Office',
      addressLine2: 'Western Province',
      phone: '+94 11 280 8835',
      email: 'site531m@maga.lk',
      status: 'active',
    },
    {
      subdomain: '521M',
      companyName: 'Kandy Road Rehabilitation',
      addressLine1: 'Kandy Road Site Office',
      addressLine2: 'Central Province',
      phone: '+94 81 223 4567',
      email: 'site521m@maga.lk',
      status: 'active',
    },
    {
      subdomain: '403M',
      companyName: 'SEEP Project',
      addressLine1: 'M00000403 Site Base',
      addressLine2: 'Colombo',
      phone: '+94 11 255 1234',
      email: 'seep403m@maga.lk',
      status: 'active',
    },
  ];

  const tenantMap: Record<string, string> = {};
  for (const t of tenantsData) {
    const record = await prisma.tenant.upsert({
      where: { subdomain: t.subdomain },
      update: {
        companyName: t.companyName,
        addressLine1: t.addressLine1,
        addressLine2: t.addressLine2,
        phone: t.phone,
        email: t.email,
        status: t.status,
      },
      create: t,
    });
    tenantMap[t.subdomain] = record.id;
  }
  const defaultTenantId = tenantMap['maga'];
  console.log(`✅ Tenants seeded (${Object.keys(tenantMap).length} organizations)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DAY TYPES (Standard 5 Construction Day Types)
  // ─────────────────────────────────────────────────────────────────────────
  // Rules:
  // - Normal Day: 8.0h cap, >8h is OT
  // - Saturday: 6.0h cap (07:00-13:00), >13:00 is OT
  // - Sunday: 0.0h cap (100% Full Time OT)
  // - Shutdown: 8.0h cap (treated like Normal Day)
  // - Public Holiday: 0.0h cap (100% Full Time OT)
  const dayTypes = [
    { name: 'Normal Day', rateMultiplier: 1.0 },
    { name: 'Saturday', rateMultiplier: 1.0 },
    { name: 'Sunday', rateMultiplier: 1.5 },
    { name: 'Shutdown', rateMultiplier: 1.0 },
    { name: 'Public Holiday', rateMultiplier: 2.0 },
  ];

  const dayTypeMap: Record<string, string> = {};
  for (const dt of dayTypes) {
    const record = await prisma.dayType.upsert({
      where: {
        tenantId_name: {
          tenantId: defaultTenantId,
          name: dt.name,
        },
      },
      update: { rateMultiplier: dt.rateMultiplier },
      create: {
        tenantId: defaultTenantId,
        name: dt.name,
        rateMultiplier: dt.rateMultiplier,
      },
    });
    dayTypeMap[dt.name] = record.id;
  }
  console.log('✅ Day Types seeded (Normal Day, Saturday, Sunday, Shutdown, Public Holiday)');

  // ─────────────────────────────────────────────────────────────────────────
  // 3. BUSINESS PARTNERS (Contractors & Subcontractors)
  // ─────────────────────────────────────────────────────────────────────────
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
      name: 'Maga Engineering (Pvt) Ltd',
      contactPerson: 'HR Operations',
      phone: '+94 11 2808835',
      email: 'labour@maga.lk',
      address: '200, Nawala Road, Colombo 05',
    },
    {
      code: 'BP1002015',
      name: 'Alpha Constructions (Pvt) Ltd',
      contactPerson: 'Mr. N. Jayasinghe',
      phone: '+94 11 2548811',
      email: 'contact@alphacon.lk',
      address: '45, Kandy Road, Kelaniya',
    },
    {
      code: 'BP1003042',
      name: 'Beta Projects & Engineering',
      contactPerson: 'Mr. R. Wickramasinghe',
      phone: '+94 11 4321900',
      email: 'operations@betaprojects.lk',
      address: '12/A, Galle Road, Colombo 03',
    },
    {
      code: 'BP1004055',
      name: 'SL Labour Co-operative',
      contactPerson: 'Mr. K. Perera',
      phone: '+94 11 5678123',
      email: 'labour@sllc.lk',
      address: '78, High Level Road, Maharagama',
    },
    {
      code: 'BP1005080',
      name: 'BuildForce Manpower Services',
      contactPerson: 'Mr. A. Fernando',
      phone: '+94 11 7890123',
      email: 'info@buildforce.lk',
      address: '105, Negombo Road, Ja-Ela',
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

  const bpCodeToId: Record<string, string> = {};
  for (const bp of businessPartners) {
    const partner = await prisma.businessPartner.upsert({
      where: {
        tenantId_code: {
          tenantId: defaultTenantId,
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
        tenantId: defaultTenantId,
        code: bp.code,
        name: bp.name,
        contactPerson: bp.contactPerson,
        phone: bp.phone,
        email: bp.email,
        address: bp.address,
      },
    });
    bpCodeToId[bp.code] = partner.id;
  }
  console.log(`✅ Business Partners seeded (${businessPartners.length} partners)`);

  // Helper to map partner name string to BP id
  function getPartnerIdByName(name: string): string {
    const lower = (name || '').toLowerCase();
    if (lower.includes('aruna')) return bpCodeToId['BP1004093'];
    if (lower.includes('alpha')) return bpCodeToId['BP1002015'];
    if (lower.includes('beta')) return bpCodeToId['BP1003042'];
    if (lower.includes('co-operative') || lower.includes('cooperative')) return bpCodeToId['BP1004055'];
    if (lower.includes('buildforce')) return bpCodeToId['BP1005080'];
    if (lower.includes('laksiri')) return bpCodeToId['BP1002004'];
    if (lower.includes('gamini')) return bpCodeToId['BP1003012'];
    return bpCodeToId['BP1001001']; // Default Maga Engineering
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ACTIVITY CODES (23 ERP Work Breakdown Codes)
  // ─────────────────────────────────────────────────────────────────────────
  const activityCodes = [
    { code: '00-00-10-00', description: 'Other site over head' },
    { code: '00-00-11-11-M', description: 'Direct Labour Masonry Works' },
    { code: '00-00-11-13', description: 'Welfare Facilities - Meals and Tea - for Contractor' },
    { code: '00-00-11-30', description: 'Salaries and Wages - for Contractor' },
    { code: '00-00-20-10', description: 'Dayworks - Labour' },
    { code: '00-00-20-20', description: 'Dayworks - Equipment' },
    { code: '00-00-20-30', description: 'Dayworks - Materials' },
    { code: '00-00-50-00', description: 'Head office Overhead' },
    { code: '00-61-00-00', description: 'Bonds & Guarantees' },
    { code: '00-61-13-13', description: 'Performance Bond' },
    { code: '00-61-27-00', description: 'Advance Bond' },
    { code: '00-62-16-00', description: 'Insurance' },
    { code: '00-62-16-13', description: "Insurance - Contractor's All Risk (CAR)" },
    { code: '01-10-10-00', description: 'Excavation & Earthwork' },
    { code: '01-20-10-00', description: 'Concrete Work - Substructure' },
    { code: '02-10-10-00', description: 'Formwork - Superstructure' },
    { code: '02-20-10-00', description: 'Rebar & Steel Reinforcement' },
    { code: '03-10-10-00', description: 'Masonry Block & Brick Laying' },
    { code: '03-20-10-00', description: 'Plastering Work' },
    { code: '04-10-10-00', description: 'Plumbing & Drainage Work' },
    { code: '04-20-10-00', description: 'Electrical Conduit & Cabling' },
    { code: '05-10-10-00', description: 'Tile Laying & Finishes' },
    { code: '05-20-10-00', description: 'Painting & Surface Coating' },
    { code: '06-10-10-00', description: 'Welding & Structural Steel' },
  ];

  const activityCodeMap: Record<string, string> = {};
  for (const ac of activityCodes) {
    const record = await prisma.activityCode.upsert({
      where: {
        tenantId_code: {
          tenantId: defaultTenantId,
          code: ac.code,
        },
      },
      update: { description: ac.description },
      create: {
        tenantId: defaultTenantId,
        code: ac.code,
        description: ac.description,
      },
    });
    activityCodeMap[ac.code] = record.id;
  }
  console.log(`✅ Activity Codes seeded (${activityCodes.length} codes)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. EQUIPMENT (14 Site Machinery Items)
  // ─────────────────────────────────────────────────────────────────────────
  const equipmentList = [
    { code: 'MACM0075', name: 'AIR COMPRESSOR INGERSOLL RAND', type: 'Air compressor' },
    { code: 'MACM0146', name: 'AIR COMPRESSOR FS CURTIS', type: 'Air compressor' },
    { code: 'MACM0158', name: 'AIR COMPRESSOR SULLAIR', type: 'Air compressor' },
    { code: 'MACM0163', name: 'AIR COMPRESSOR ATLAS COPCO', type: 'Air compressor' },
    { code: 'MACM0164', name: 'AIR COMPRESSOR DOOSAN', type: 'Air compressor' },
    { code: 'MACM0170', name: 'AIR COMPRESSOR KAESER', type: 'Air compressor' },
    { code: 'MEXC0012', name: 'EXCAVATOR CAT 320D', type: 'Heavy machinery' },
    { code: 'MJCB0034', name: 'BACKHOE LOADER JCB 3CX', type: 'Heavy machinery' },
    { code: 'MCRN0018', name: 'TOWER CRANE TC-5010', type: 'Crane' },
    { code: 'MTRK0056', name: 'DUMP TRUCK ISUZU 10T', type: 'Transport' },
    { code: 'MMIX0025', name: 'CONCRETE MIXER 350L', type: 'Concrete' },
    { code: 'MROL0042', name: 'COMPACTOR ROLLER BOMAG 8T', type: 'Compaction' },
    { code: 'MGEN0088', name: 'GENERATOR CUMMINS 50kVA', type: 'Power' },
    { code: 'MWEL0091', name: 'WELDING MACHINE INVERTER 400A', type: 'Welding' },
  ];

  const equipmentMap: Record<string, string> = {};
  for (const eq of equipmentList) {
    const record = await prisma.equipment.upsert({
      where: {
        tenantId_code: {
          tenantId: defaultTenantId,
          code: eq.code,
        },
      },
      update: { name: eq.name, type: eq.type },
      create: {
        tenantId: defaultTenantId,
        code: eq.code,
        name: eq.name,
        type: eq.type,
      },
    });
    equipmentMap[eq.code] = record.id;
  }
  console.log(`✅ Equipment seeded (${equipmentList.length} items)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. EMPLOYEES (Full 70+ Workforce Master Labour List)
  // ─────────────────────────────────────────────────────────────────────────
  const allEmployees = [
    // Site Labour Details (from Master Labour List)
    { employeeCode: 'HK030', callingName: 'HK030', fullName: 'Lab Helper HK030', businessPartner: 'Maga', tradeGroup: 'Lab Helper', nicNo: '961173612V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK031', callingName: 'HK031', fullName: 'Lab Helper HK031', businessPartner: 'Maga', tradeGroup: 'Lab Helper', nicNo: '200531503866', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI258', callingName: 'HI258', fullName: 'Cook HI258', businessPartner: 'Maga', tradeGroup: 'Cook', nicNo: '197235100210', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK032', callingName: 'HK032', fullName: 'Helper HK032', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200307101128', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK033', callingName: 'HK033', fullName: 'Helper HK033', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200635000602', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK034', callingName: 'HK034', fullName: 'Helper HK034', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '922513082V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK035', callingName: 'HK035', fullName: 'Helper HK035', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200130701719', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI911', callingName: 'HI911', fullName: 'Helper HI911', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '950082836V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI265', callingName: 'HI265', fullName: 'Helper HI265', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '710734364V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK121', callingName: 'HK121', fullName: 'Helper HK121', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '921853670V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK122', callingName: 'HK122', fullName: 'Helper HK122', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '198212803752', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK123', callingName: 'HK123', fullName: 'Helper HK123', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '198709902610', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK124', callingName: 'HK124', fullName: 'Charge Hand HK124', businessPartner: 'Maga', tradeGroup: 'Charge Hand', nicNo: '982990386V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI394', callingName: 'HI394', fullName: 'Carpentor HI394', businessPartner: 'Maga', tradeGroup: 'Carpentor', nicNo: '853454435V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HK947', callingName: 'HK947', fullName: 'Helper HK947', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200607304610', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HL056', callingName: 'HL056', fullName: 'Helper HL056', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200800501773', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HK948', callingName: 'HK948', fullName: 'Helper HK948', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '892215006V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HL057', callingName: 'HL057', fullName: 'Helper HL057', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200421204651', dailyRate: 1400.00, epfNo: '' },

    // Masons (100 Series)
    { employeeCode: 'HI101', callingName: '101', fullName: 'Kamal Perera', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '881234567V', dailyRate: 1600.00, epfNo: 'EPF-9021' },
    { employeeCode: 'HI102', callingName: '102', fullName: 'Lakmal Dissanayake', businessPartner: 'Beta Projects', tradeGroup: 'Mason', nicNo: '891234573V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI103', callingName: '103', fullName: 'Sampath Ranasinghe', businessPartner: 'Beta Projects', tradeGroup: 'Mason', nicNo: '871234579V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI104', callingName: '104', fullName: 'Mahesh Jayasundara', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '921234585V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI105', callingName: '105', fullName: 'Lasantha Peiris', businessPartner: 'Beta Projects', tradeGroup: 'Mason', nicNo: '851234592V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI106', callingName: '106', fullName: 'Sanjeewa Athukorala', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '841234600V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI107', callingName: '107', fullName: 'Sarath Edirisinghe', businessPartner: 'Alpha Constructions', tradeGroup: 'Mason', nicNo: '821234605V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI108', callingName: '108', fullName: 'Sisira Weerakoon', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '861234612V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI109', callingName: '109', fullName: 'Priyadarshana Boteju', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '921234621V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI110', callingName: '110', fullName: 'Dananjaya Lakshan', businessPartner: 'Alpha Constructions', tradeGroup: 'Mason', nicNo: '981234629V', dailyRate: 1450.00, epfNo: '' },
    { employeeCode: 'HI111', callingName: '111', fullName: 'Praveen Jayawickrama', businessPartner: 'Alpha Constructions', tradeGroup: 'Mason', nicNo: '981234638V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI112', callingName: '112', fullName: 'Nuwan Thushara', businessPartner: 'Beta Projects', tradeGroup: 'Mason', nicNo: '941234649V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI113', callingName: '113', fullName: 'Channa Vithanage', businessPartner: 'Maga Engineering', tradeGroup: 'Mason', nicNo: '891234660V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI114', callingName: '114', fullName: 'Bandula Warnasuriya', businessPartner: 'Alpha Constructions', tradeGroup: 'Mason', nicNo: '831234667V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI115', callingName: '115', fullName: 'Dhammika Prasad', businessPartner: 'Beta Projects', tradeGroup: 'Mason', nicNo: '871234668V', dailyRate: 1400.00, epfNo: '' },

    // Carpenters (200 Series)
    { employeeCode: 'HI201', callingName: '201', fullName: 'Nimal Silva', businessPartner: 'Maga Engineering', tradeGroup: 'Carpenter', nicNo: '901234568V', dailyRate: 1550.00, epfNo: 'EPF-9022' },
    { employeeCode: 'HI202', callingName: '202', fullName: 'Asanka Kumara', businessPartner: 'Maga Engineering', tradeGroup: 'Carpenter', nicNo: '941234574V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI203', callingName: '203', fullName: 'Ajith Mendis', businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter', nicNo: '841234581V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI204', callingName: '204', fullName: 'Gayan Karunaratne', businessPartner: 'Beta Projects', tradeGroup: 'Carpenter', nicNo: '901234589V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI205', callingName: '205', fullName: 'Duminda De Silva', businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter', nicNo: '871234596V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI206', callingName: '206', fullName: 'Jagath Kulatunga', businessPartner: 'Beta Projects', tradeGroup: 'Carpenter', nicNo: '881234604V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI207', callingName: '207', fullName: 'Dayan Jayatillake', businessPartner: 'Beta Projects', tradeGroup: 'Carpenter', nicNo: '931234613V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI208', callingName: '208', fullName: 'Kusal Mendis', businessPartner: 'Beta Projects', tradeGroup: 'Carpenter', nicNo: '951234622V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI209', callingName: '209', fullName: 'Avishka Fernando', businessPartner: 'Maga Engineering', tradeGroup: 'Carpenter', nicNo: '981234630V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI210', callingName: '210', fullName: 'Binura Fernando', businessPartner: 'Maga Engineering', tradeGroup: 'Carpenter', nicNo: '951234639V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI211', callingName: '211', fullName: 'Sachith Pathirana', businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter', nicNo: '891234650V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI212', callingName: '212', fullName: 'Samantha Lokuge', businessPartner: 'Beta Projects', tradeGroup: 'Carpenter', nicNo: '851234661V', dailyRate: 1500.00, epfNo: '' },

    // Electricians (300 Series)
    { employeeCode: 'HI301', callingName: '301', fullName: 'Sunil Fernando', businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician', nicNo: '851234569V', dailyRate: 1650.00, epfNo: '' },
    { employeeCode: 'HI302', callingName: '302', fullName: 'Dinesh Wickramasinghe', businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician', nicNo: '861234575V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI303', callingName: '303', fullName: 'Dhanushka Gamage', businessPartner: 'Maga Engineering', tradeGroup: 'Electrician', nicNo: '861234588V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI304', callingName: '304', fullName: 'Sameera Pathirana', businessPartner: 'Beta Projects', tradeGroup: 'Electrician', nicNo: '911234595V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI305', callingName: '305', fullName: 'Priyantha Tennakoon', businessPartner: 'Beta Projects', tradeGroup: 'Electrician', nicNo: '891234607V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI306', callingName: '306', fullName: 'Kapila Basnayake', businessPartner: 'Maga Engineering', tradeGroup: 'Electrician', nicNo: '901234615V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI307', callingName: '307', fullName: 'Sahan Arachchige', businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician', nicNo: '941234626V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI308', callingName: '308', fullName: 'Dhananjaya De Silva', businessPartner: 'Beta Projects', tradeGroup: 'Electrician', nicNo: '911234637V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI309', callingName: '309', fullName: 'Kasun Rajitha', businessPartner: 'Maga Engineering', tradeGroup: 'Electrician', nicNo: '931234648V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI310', callingName: '310', fullName: 'Thusitha Mudalige', businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician', nicNo: '861234659V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI311', callingName: '311', fullName: 'Indrajith Jayasena', businessPartner: 'Maga Engineering', tradeGroup: 'Electrician', nicNo: '881234669V', dailyRate: 1600.00, epfNo: '' },

    // Welders (400 Series)
    { employeeCode: 'HI401', callingName: '401', fullName: 'Pradeep Bandara', businessPartner: 'Maga Engineering', tradeGroup: 'Welder', nicNo: '931234572V', dailyRate: 1700.00, epfNo: '' },
    { employeeCode: 'HI402', callingName: '402', fullName: 'Nuwan Samaraweera', businessPartner: 'Alpha Constructions', tradeGroup: 'Welder', nicNo: '911234578V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI403', callingName: '403', fullName: 'Isuru Weerasinghe', businessPartner: 'Alpha Constructions', tradeGroup: 'Welder', nicNo: '941234590V', dailyRate: 1650.00, epfNo: '' },
    { employeeCode: 'HI404', callingName: '404', fullName: 'Sandun Kariyawasam', businessPartner: 'Beta Projects', tradeGroup: 'Welder', nicNo: '891234598V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI405', callingName: '405', fullName: 'Rohana Senaratne', businessPartner: 'Beta Projects', tradeGroup: 'Welder', nicNo: '871234610V', dailyRate: 1650.00, epfNo: '' },
    { employeeCode: 'HI406', callingName: '406', fullName: 'Dimuth Karunaratne', businessPartner: 'Alpha Constructions', tradeGroup: 'Welder', nicNo: '881234623V', dailyRate: 1700.00, epfNo: '' },
    { employeeCode: 'HI407', callingName: '407', fullName: 'Pathum Nissanka', businessPartner: 'Alpha Constructions', tradeGroup: 'Welder', nicNo: '981234632V', dailyRate: 1650.00, epfNo: '' },
    { employeeCode: 'HI408', callingName: '408', fullName: 'Milan Rathnayake', businessPartner: 'Maga Engineering', tradeGroup: 'Welder', nicNo: '961234642V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI409', callingName: '409', fullName: 'Chamara Silva', businessPartner: 'Alpha Constructions', tradeGroup: 'Welder', nicNo: '791234653V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI410', callingName: '410', fullName: 'Thilina Kandamby', businessPartner: 'Beta Projects', tradeGroup: 'Welder', nicNo: '821234664V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI411', callingName: '411', fullName: 'Maduranga Fonseka', businessPartner: 'Maga Engineering', tradeGroup: 'Welder', nicNo: '921234670V', dailyRate: 1650.00, epfNo: '' },

    // Plumbers (500 Series)
    { employeeCode: 'HI501', callingName: '501', fullName: 'Ruwan Jayawardena', businessPartner: 'Beta Projects', tradeGroup: 'Plumber', nicNo: '871234571V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI502', callingName: '502', fullName: 'Tharanga Abeysekara', businessPartner: 'Maga Engineering', tradeGroup: 'Plumber', nicNo: '881234577V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI503', callingName: '503', fullName: 'Supun Alwis', businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber', nicNo: '971234587V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI504', callingName: '504', fullName: 'Kavinda Jayamaha', businessPartner: 'Maga Engineering', tradeGroup: 'Plumber', nicNo: '961234597V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI505', callingName: '505', fullName: 'Mahinda Jayakody', businessPartner: 'Maga Engineering', tradeGroup: 'Plumber', nicNo: '841234609V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI506', callingName: '506', fullName: 'Shantha Samarasekera', businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber', nicNo: '841234620V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI507', callingName: '507', fullName: 'Wanindu Hasaranga', businessPartner: 'Beta Projects', tradeGroup: 'Plumber', nicNo: '971234631V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI508', callingName: '508', fullName: 'Nuwanidu Fernando', businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber', nicNo: '991234641V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI509', callingName: '509', fullName: 'Suranga Lakmal', businessPartner: 'Beta Projects', tradeGroup: 'Plumber', nicNo: '871234562V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI510', callingName: '510', fullName: 'Senaka Dias', businessPartner: 'Maga Engineering', tradeGroup: 'Plumber', nicNo: '881234663V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI511', callingName: '511', fullName: 'Chinthaka Jayasinghe', businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber', nicNo: '811234671V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI512', callingName: '512', fullName: 'Ruwantha Kumara', businessPartner: 'Beta Projects', tradeGroup: 'Plumber', nicNo: '951234672V', dailyRate: 1500.00, epfNo: '' },

    // General Labour (600 Series)
    { employeeCode: 'HI601', callingName: '601', fullName: 'Chaminda Rajapakse', businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '921234570V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI602', callingName: '602', fullName: 'Roshan Gunawardena', businessPartner: 'Beta Projects', tradeGroup: 'General labour', nicNo: '951234576V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI603', callingName: '603', fullName: 'Udara Liyanage', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '961234580V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI604', callingName: '604', fullName: 'Lahiru Cooray', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '981234591V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI605', callingName: '605', fullName: 'Harsha Wickramaratne', businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '921234599V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI606', callingName: '606', fullName: 'Gamini Ekanayake', businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '811234608V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI607', callingName: '607', fullName: 'Ranjith Herath', businessPartner: 'Beta Projects', tradeGroup: 'General labour', nicNo: '851234616V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI608', callingName: '608', fullName: 'Malith Madushanka', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '971234627V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI609', callingName: '609', fullName: 'Dunith Wellalage', businessPartner: 'Beta Projects', tradeGroup: 'General labour', nicNo: '20031234643V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI610', callingName: '610', fullName: 'Navod Paranavithana', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '20021234654V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI611', callingName: '611', fullName: 'Dilshan Munaweera', businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '891234665V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI612', callingName: '612', fullName: 'Asitha Fernando', businessPartner: 'Beta Projects', tradeGroup: 'General labour', nicNo: '971234673V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI613', callingName: '613', fullName: 'Nuwan Pradeep', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '861234674V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI614', callingName: '614', fullName: 'Sahan Sandaruwan', businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '991234675V', dailyRate: 1400.00, epfNo: '' },
    { employeeCode: 'HI678', callingName: '678', fullName: 'Anura Hettiarachchi', businessPartner: 'Maga Engineering', tradeGroup: 'General labour', nicNo: '911234676V', dailyRate: 1400.00, epfNo: '' },

    // Bar Benders (700 Series)
    { employeeCode: 'HI701', callingName: '701', fullName: 'Kasun Fonseka', businessPartner: 'Maga Engineering', tradeGroup: 'Bar Bender', nicNo: '912345682V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI702', callingName: '702', fullName: 'Chathura Nanayakkara', businessPartner: 'Maga Engineering', tradeGroup: 'Bar Bender', nicNo: '931234594V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI703', callingName: '703', fullName: 'Wasantha Samarawickrama', businessPartner: 'Maga Engineering', tradeGroup: 'Bar Bender', nicNo: '851234606V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI704', callingName: '704', fullName: 'Sumith Ilangakoon', businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender', nicNo: '891234617V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI705', callingName: '705', fullName: 'Charith Asalanka', businessPartner: 'Beta Projects', tradeGroup: 'Bar Bender', nicNo: '971234628V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI706', callingName: '706', fullName: 'Pramod Madushan', businessPartner: 'Beta Projects', tradeGroup: 'Bar Bender', nicNo: '931234640V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI707', callingName: '707', fullName: 'Lahiru Madushanka', businessPartner: 'Maga Engineering', tradeGroup: 'Bar Bender', nicNo: '921234651V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI708', callingName: '708', fullName: 'Kumara Dharmasena', businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender', nicNo: '711234662V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI709', callingName: '709', fullName: 'Hirantha Jayalath', businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender', nicNo: '901234677V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI710', callingName: '710', fullName: 'Viraj Wickramasinghe', businessPartner: 'Beta Projects', tradeGroup: 'Bar Bender', nicNo: '881234678V', dailyRate: 1550.00, epfNo: '' },

    // Painters (800 Series)
    { employeeCode: 'HI801', callingName: '801', fullName: 'Bandara Senanayake', businessPartner: 'Beta Projects', tradeGroup: 'Painter', nicNo: '831234583V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI802', callingName: '802', fullName: 'Anura Premaratne', businessPartner: 'Alpha Constructions', tradeGroup: 'Painter', nicNo: '831234602V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI803', callingName: '803', fullName: 'Neville Wijeratne', businessPartner: 'Maga Engineering', tradeGroup: 'Painter', nicNo: '821234618V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI804', callingName: '804', fullName: 'Dasun Shanaka', businessPartner: 'Beta Projects', tradeGroup: 'Painter', nicNo: '911234634V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI805', callingName: '805', fullName: 'Dushan Hemantha', businessPartner: 'Alpha Constructions', tradeGroup: 'Painter', nicNo: '941234644V', dailyRate: 1500.00, epfNo: '' },
    { employeeCode: 'HI806', callingName: '806', fullName: 'Sandeep Shaminda', businessPartner: 'Alpha Constructions', tradeGroup: 'Painter', nicNo: '961234656V', dailyRate: 1500.00, epfNo: '' },

    // Steel Fixers, Scaffolders & Tile Layers (900 Series)
    { employeeCode: 'HI901', callingName: '901', fullName: 'Janaka Wijesinghe', businessPartner: 'Alpha Constructions', tradeGroup: 'Steel Fixer', nicNo: '891234584V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI902', callingName: '902', fullName: 'Sajith Rathnayake', businessPartner: 'Beta Projects', tradeGroup: 'Scaffolder', nicNo: '951234586V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI903', callingName: '903', fullName: 'Manjula Hettiarachchi', businessPartner: 'Alpha Constructions', tradeGroup: 'Tile Layer', nicNo: '881234593V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI904', callingName: '904', fullName: 'Indika Munasinghe', businessPartner: 'Beta Projects', tradeGroup: 'Steel Fixer', nicNo: '901234601V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI905', callingName: '905', fullName: 'Lalith Warnakulasooriya', businessPartner: 'Maga Engineering', tradeGroup: 'Scaffolder', nicNo: '861234603V', dailyRate: 1550.00, epfNo: '' },
    { employeeCode: 'HI906', callingName: '906', fullName: 'Upul Chandrasena', businessPartner: 'Alpha Constructions', tradeGroup: 'Tile Layer', nicNo: '911234611V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI907', callingName: '907', fullName: 'Ravindra Seneviratne', businessPartner: 'Alpha Constructions', tradeGroup: 'Steel Fixer', nicNo: '881234614V', dailyRate: 1600.00, epfNo: '' },
    { employeeCode: 'HI908', callingName: '908', fullName: 'Jayantha Jayalath', businessPartner: 'Beta Projects', tradeGroup: 'Scaffolder', nicNo: '871234619V', dailyRate: 1550.00, epfNo: '' },
  ];

  const empCodeToId: Record<string, string> = {};
  for (const emp of allEmployees) {
    const bpId = getPartnerIdByName(emp.businessPartner);
    const record = await prisma.employee.upsert({
      where: {
        tenantId_employeeCode: {
          tenantId: defaultTenantId,
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
        businessPartnerId: bpId,
      },
      create: {
        tenantId: defaultTenantId,
        employeeCode: emp.employeeCode,
        callingName: emp.callingName,
        fullName: emp.fullName,
        tradeGroup: emp.tradeGroup,
        nicNo: emp.nicNo,
        dailyRate: emp.dailyRate,
        epfNo: emp.epfNo,
        businessPartnerId: bpId,
      },
    });
    empCodeToId[emp.employeeCode] = record.id;
  }
  console.log(`✅ Employees seeded (${allEmployees.length} labour master records)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. USERS (Admin & Site Supervisors with Password Hash)
  // ─────────────────────────────────────────────────────────────────────────
  // admin123 hash: $2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);

  const systemUsers = [
    {
      tenantId: defaultTenantId,
      username: 'admin',
      fullName: 'System Administrator',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      tenantId: defaultTenantId,
      username: 'supervisor1',
      fullName: 'Ruwan Jayasinghe (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      tenantId: defaultTenantId,
      username: 'supervisor2',
      fullName: 'Chaminda Wijesekara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
    {
      tenantId: defaultTenantId,
      username: 'supervisor3',
      fullName: 'Nimal Bandara (Site Supervisor)',
      role: 'supervisor',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    },
  ];

  // Also add site admins for other mock tenants if they exist
  if (tenantMap['531M']) {
    systemUsers.push({
      tenantId: tenantMap['531M'],
      username: 'admin531m',
      fullName: 'Site Admin (531M)',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    });
  }
  if (tenantMap['521M']) {
    systemUsers.push({
      tenantId: tenantMap['521M'],
      username: 'admin521m',
      fullName: 'Site Admin (521M)',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
    });
  }

  const userMap: Record<string, string> = {};
  for (const u of systemUsers) {
    const userRecord = await prisma.user.upsert({
      where: {
        tenantId_username: {
          tenantId: u.tenantId,
          username: u.username,
        },
      },
      update: {
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
      },
      create: {
        tenantId: u.tenantId,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        passwordHash: u.passwordHash,
        mustChangePassword: u.mustChangePassword,
      },
    });
    userMap[u.username] = userRecord.id;
  }
  console.log(`✅ System Users & Supervisors seeded (${systemUsers.length} users)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 8. CALENDAR DAYS (Pre-populate Current Month with Sunday, Saturday & Sample Holidays)
  // ─────────────────────────────────────────────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month, d));
    const dow = dateObj.getUTCDay();

    let targetDayTypeId = dayTypeMap['Normal Day'];
    let remarks: string | null = null;

    if (dow === 0) {
      targetDayTypeId = dayTypeMap['Sunday'];
      remarks = 'Weekly Sunday Rest (Full OT)';
    } else if (dow === 6) {
      targetDayTypeId = dayTypeMap['Saturday'];
      remarks = 'Saturday Half Day (OT after 1 PM)';
    } else if (d === 15) {
      targetDayTypeId = dayTypeMap['Public Holiday'];
      remarks = 'National Public Holiday (Full OT)';
    } else if (d === 28) {
      targetDayTypeId = dayTypeMap['Shutdown'];
      remarks = 'Plant Maintenance Shutdown (Normal Day rules)';
    }

    if (targetDayTypeId) {
      await prisma.calendarDay.upsert({
        where: {
          tenantId_date: {
            tenantId: defaultTenantId,
            date: dateObj,
          },
        },
        update: {
          dayTypeId: targetDayTypeId,
          remarks,
        },
        create: {
          tenantId: defaultTenantId,
          date: dateObj,
          dayTypeId: targetDayTypeId,
          remarks,
        },
      });
    }
  }
  console.log(`✅ Calendar days seeded for ${year}-${String(month + 1).padStart(2, '0')} (${daysInMonth} days)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 9. DAILY GANG ASSIGNMENTS (Admin assigns Workers to Supervisors)
  // ─────────────────────────────────────────────────────────────────────────
  const sup1Id = userMap['supervisor1'];
  const sup2Id = userMap['supervisor2'];

  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterdayUtc = new Date(todayUtc.getTime() - 86400000);

  const gangAssignments = [
    // Today for supervisor1
    { date: todayUtc, supervisorId: sup1Id, empCode: 'HK030' },
    { date: todayUtc, supervisorId: sup1Id, empCode: 'HK031' },
    { date: todayUtc, supervisorId: sup1Id, empCode: 'HI101' },
    { date: todayUtc, supervisorId: sup1Id, empCode: 'HI201' },
    { date: todayUtc, supervisorId: sup1Id, empCode: 'HI601' },
    // Today for supervisor2
    { date: todayUtc, supervisorId: sup2Id, empCode: 'HI102' },
    { date: todayUtc, supervisorId: sup2Id, empCode: 'HI202' },
    { date: todayUtc, supervisorId: sup2Id, empCode: 'HI301' },
    { date: todayUtc, supervisorId: sup2Id, empCode: 'HI401' },
    // Yesterday for supervisor1
    { date: yesterdayUtc, supervisorId: sup1Id, empCode: 'HK030' },
    { date: yesterdayUtc, supervisorId: sup1Id, empCode: 'HK031' },
    { date: yesterdayUtc, supervisorId: sup1Id, empCode: 'HI101' },
    // Yesterday for supervisor2
    { date: yesterdayUtc, supervisorId: sup2Id, empCode: 'HI102' },
    { date: yesterdayUtc, supervisorId: sup2Id, empCode: 'HI301' },
  ];

  for (const asgn of gangAssignments) {
    const employeeId = empCodeToId[asgn.empCode];
    if (employeeId && asgn.supervisorId) {
      await prisma.dailyAssignment.upsert({
        where: {
          tenantId_date_employeeId: {
            tenantId: defaultTenantId,
            date: asgn.date,
            employeeId,
          },
        },
        update: {
          supervisorId: asgn.supervisorId,
        },
        create: {
          tenantId: defaultTenantId,
          date: asgn.date,
          supervisorId: asgn.supervisorId,
          employeeId,
        },
      });
    }
  }
  console.log(`✅ Daily gang assignments seeded (${gangAssignments.length} assignments)`);

  // ─────────────────────────────────────────────────────────────────────────
  // 10. SAMPLE TIME ENTRIES (Attendance, Check-in/out, and Activity Allocations)
  // ─────────────────────────────────────────────────────────────────────────
  const masonryActId = activityCodeMap['00-00-11-11-M'] || Object.values(activityCodeMap)[0];
  const rebarActId = activityCodeMap['02-20-10-00'] || Object.values(activityCodeMap)[1];
  const mixerEquipId = equipmentMap['MMIX0025'] || null;

  const sampleTimeEntries = [
    {
      employeeCode: 'HK030',
      supervisorId: sup1Id,
      date: yesterdayUtc,
      activityId: masonryActId,
      equipmentId: mixerEquipId,
      effectiveDayTypeId: dayTypeMap['Normal Day'],
      inTime: '07:00',
      outTime: '17:30',
      hours: 10.5,
      overtimeHours: 2.5, // 10.5 - 8.0 = 2.5 OT
      remarks: 'Masonry direct labour assistance',
      status: 'submitted',
      submittedAt: new Date(),
    },
    {
      employeeCode: 'HK031',
      supervisorId: sup1Id,
      date: yesterdayUtc,
      activityId: masonryActId,
      equipmentId: null,
      effectiveDayTypeId: dayTypeMap['Normal Day'],
      inTime: '07:00',
      outTime: '17:00',
      hours: 10.0,
      overtimeHours: 2.0, // 10.0 - 8.0 = 2.0 OT
      remarks: 'Scaffolding & helper works',
      status: 'submitted',
      submittedAt: new Date(),
    },
    {
      employeeCode: 'HI101',
      supervisorId: sup1Id,
      date: yesterdayUtc,
      activityId: rebarActId,
      equipmentId: null,
      effectiveDayTypeId: dayTypeMap['Normal Day'],
      inTime: '07:00',
      outTime: '19:00',
      hours: 12.0,
      overtimeHours: 4.0, // 12.0 - 8.0 = 4.0 OT
      remarks: 'Steel fixing concrete columns',
      status: 'submitted',
      submittedAt: new Date(),
    },
  ];

  for (const te of sampleTimeEntries) {
    const employeeId = empCodeToId[te.employeeCode];
    if (employeeId && te.supervisorId) {
      const existing = await prisma.timeEntry.findFirst({
        where: {
          tenantId: defaultTenantId,
          employeeId,
          date: te.date,
          activityId: te.activityId,
        },
      });

      if (existing) {
        await prisma.timeEntry.update({
          where: { id: existing.id },
          data: {
            hours: te.hours,
            overtimeHours: te.overtimeHours,
            inTime: te.inTime,
            outTime: te.outTime,
            equipmentId: te.equipmentId,
            remarks: te.remarks,
            status: te.status,
            submittedAt: te.submittedAt,
          },
        });
      } else {
        await prisma.timeEntry.create({
          data: {
            tenantId: defaultTenantId,
            employeeId,
            supervisorId: te.supervisorId,
            activityId: te.activityId,
            equipmentId: te.equipmentId,
            effectiveDayTypeId: te.effectiveDayTypeId,
            date: te.date,
            inTime: te.inTime,
            outTime: te.outTime,
            hours: te.hours,
            overtimeHours: te.overtimeHours,
            remarks: te.remarks,
            status: te.status,
            submittedAt: te.submittedAt,
          },
        });
      }
    }
  }
  console.log('✅ Sample Time Entries seeded for supervisor flow & reports');

  console.log('🎉 Neon PostgreSQL Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
