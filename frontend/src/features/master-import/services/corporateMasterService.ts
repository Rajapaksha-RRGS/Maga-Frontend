/**
 * corporateMasterService.ts
 *
 * Central Corporate ERP Master Data Repository (IFS / SAP / Central Database).
 * Provides verified master data records across all company projects & central depots.
 * Project sites / tenants import master records from this central catalog instead
 * of typing ad-hoc manual records.
 */

export interface CorporateEquipment {
  code: string;
  name: string;
  type: string;
  model: string;
  registrationNo: string;
  capacity: string;
  sourceProject: string;
  status: 'active';
}

export interface CorporateBusinessPartner {
  code: string;
  name: string;
  type: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  sourceProject: string;
  rating: string;
}

export interface CorporateEmployee {
  employeeCode: string;
  callingName: string;
  fullName: string;
  nicNo: string;
  tradeGroup: string;
  businessPartner: string;
  sourceProject: string;
  dailyRate: number;
  epfNo: string;
  skillLevel: string;
}

export interface CorporateActivityCode {
  code: string;
  description: string;
  tradeGroup: string;
  unit: string;
  sourceProject: string;
}

// ── 1. Central Corporate Equipment Master ─────────────────────────────────────
export const CORPORATE_EQUIPMENT_CATALOG: CorporateEquipment[] = [
  {
    code: 'MEXC0012',
    name: 'CAT 320D Hydraulic Excavator',
    type: 'Heavy machinery',
    model: 'CAT 320D2 GC',
    registrationNo: 'WP-SP-4821',
    capacity: '20 Tons / 1.0 m³',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    status: 'active',
  },
  {
    code: 'MEXC0015',
    name: 'Komatsu PC210-10 Crawler Excavator',
    type: 'Heavy machinery',
    model: 'PC210LC-10',
    registrationNo: 'WP-LB-9022',
    capacity: '21.5 Tons / 1.2 m³',
    sourceProject: 'Central Expressway Project (CEP-02)',
    status: 'active',
  },
  {
    code: 'MJCB0034',
    name: 'JCB 3CX Eco Backhoe Loader',
    type: 'Heavy machinery',
    model: '3CX-4T 4WD',
    registrationNo: 'CP-NB-3411',
    capacity: '1.2 m³ Bucket / 4.2m Dig',
    sourceProject: 'Kandy Highway Development',
    status: 'active',
  },
  {
    code: 'MJCB0041',
    name: 'CAT 428F2 Backhoe Loader',
    type: 'Heavy machinery',
    model: '428F2 Sideshift',
    registrationNo: 'WP-NA-7812',
    capacity: '1.03 m³ Bucket / 4.3m Dig',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    status: 'active',
  },
  {
    code: 'MBLD0012',
    name: 'Komatsu D85ESS-2A Crawler Bulldozer',
    type: 'Earthmoving',
    model: 'D85ESS-2A',
    registrationNo: 'SG-NA-1092',
    capacity: '20.6 Tons / 3.4 m³ Blade',
    sourceProject: 'Southern Expressway Extension',
    status: 'active',
  },
  {
    code: 'MROL0042',
    name: 'Bomag BW211 D-40 Single Drum Roller',
    type: 'Compaction',
    model: 'BW211 D-40',
    registrationNo: 'WP-NC-2940',
    capacity: '11 Tons Static / 24 Tons Dyn',
    sourceProject: 'Central Expressway Project (CEP-02)',
    status: 'active',
  },
  {
    code: 'MROL0055',
    name: 'Hamm 3411 Vibratory Soil Compactor',
    type: 'Compaction',
    model: 'Hamm 3411 V',
    registrationNo: 'WP-ND-8192',
    capacity: '12 Tons / 2.14m Drum',
    sourceProject: 'Colombo Port City Infrastructure',
    status: 'active',
  },
  {
    code: 'MCRN0018',
    name: 'Liebherr 85 EC-B 5 Flat-Top Tower Crane',
    type: 'Crane',
    model: '85 EC-B 5 FR.tronic',
    registrationNo: 'TC-5010-LK',
    capacity: '5.0 Tons Max / 50m Jib',
    sourceProject: 'Colombo Port City Infrastructure',
    status: 'active',
  },
  {
    code: 'MCRN0022',
    name: 'Zoomlion QY50V Mobile Truck Crane 50T',
    type: 'Crane',
    model: 'QY50V532',
    registrationNo: 'WP-DA-3912',
    capacity: '50 Tons / 42m Main Boom',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    status: 'active',
  },
  {
    code: 'MTRK0056',
    name: 'Isuzu GIGA 10-Wheeler Dump Truck',
    type: 'Transport',
    model: 'FVZ34 6x4',
    registrationNo: 'WP-LJ-6204',
    capacity: '14 m³ / 18 Tons Payload',
    sourceProject: 'Central Expressway Project (CEP-02)',
    status: 'active',
  },
  {
    code: 'MTRK0061',
    name: 'Hino 700 Heavy Tipper Truck 12m³',
    type: 'Transport',
    model: 'FS1E 6x4',
    registrationNo: 'WP-LK-4819',
    capacity: '12 m³ / 16 Tons Payload',
    sourceProject: 'Kandy Highway Development',
    status: 'active',
  },
  {
    code: 'MMIX0025',
    name: 'Schwing Stetter Concrete Batching Plant',
    type: 'Concrete',
    model: 'CP30 Compartment Batcher',
    registrationNo: 'BP-30-PLG',
    capacity: '30 m³/h Output',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    status: 'active',
  },
  {
    code: 'MPMP0014',
    name: 'Putzmeister BSF 36-4 Truck Boom Pump',
    type: 'Concrete',
    model: 'BSF 36-4.16 H',
    registrationNo: 'WP-QA-8911',
    capacity: '160 m³/h / 36m Reach',
    sourceProject: 'Colombo Port City Infrastructure',
    status: 'active',
  },
  {
    code: 'MACM0075',
    name: 'Ingersoll Rand 750 CFM Air Compressor',
    type: 'Air compressor',
    model: 'XP750WCU-T4F',
    registrationNo: 'CMP-750-01',
    capacity: '750 CFM @ 9 Bar',
    sourceProject: 'Head Office Master Pool',
    status: 'active',
  },
  {
    code: 'MACM0146',
    name: 'Atlas Copco XAS 186 Portable Compressor',
    type: 'Air compressor',
    model: 'XAS 186 Dd',
    registrationNo: 'CMP-400-08',
    capacity: '400 CFM @ 7 Bar',
    sourceProject: 'Kandy Highway Development',
    status: 'active',
  },
  {
    code: 'MACM0163',
    name: 'Sullair 375H Rotary Screw Compressor',
    type: 'Air compressor',
    model: '375H Tier 3',
    registrationNo: 'CMP-375-14',
    capacity: '375 CFM @ 10 Bar',
    sourceProject: 'Southern Expressway Extension',
    status: 'active',
  },
  {
    code: 'MGEN0088',
    name: 'Cummins 150kVA Silent Diesel Generator',
    type: 'Power',
    model: 'C150D5e Enclosed',
    registrationNo: 'GEN-150-03',
    capacity: '150 kVA / 120 kW 3-Phase',
    sourceProject: 'Head Office Master Pool',
    status: 'active',
  },
  {
    code: 'MWEL0091',
    name: 'Lincoln Electric Inverter Welder 400A',
    type: 'Welding',
    model: 'Invertec V400-TP',
    registrationNo: 'WLD-400-22',
    capacity: '400A Multi-Process TIG/MIG',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    status: 'active',
  },
];

// ── 2. Central Corporate Business Partners Directory ──────────────────────────
export const CORPORATE_PARTNERS_CATALOG: CorporateBusinessPartner[] = [
  {
    code: 'BP-ACC01',
    name: 'Access Engineering PLC',
    type: 'Subcontractor',
    contactPerson: 'Eng. Suneth Wijesinghe',
    phone: '+94 11 2865412',
    email: 'contracts@access.lk',
    address: 'No. 278, Union Place, Colombo 02',
    sourceProject: 'Central Subcontractor Registry',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-CML02',
    name: 'CML-MTD Construction Ltd',
    type: 'Subcontractor',
    contactPerson: 'Mr. Nimal Dissanayake',
    phone: '+94 11 2589012',
    email: 'tenders@cmlmtd.com',
    address: 'Level 8, World Trade Center, Colombo 01',
    sourceProject: 'Highway Division Pool',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-NWL03',
    name: 'Nawaloka Construction (Pvt) Ltd',
    type: 'Subcontractor',
    contactPerson: 'Mr. Kamal Perera',
    phone: '+94 11 2698711',
    email: 'procurement@nawaloka.lk',
    address: 'No. 115, Sir James Peiris Mawatha, Colombo 02',
    sourceProject: 'Building Construction Division',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-SRR04',
    name: 'Sierra Construction (Pvt) Ltd',
    type: 'Subcontractor',
    contactPerson: 'Eng. Pradeep Jayasuriya',
    phone: '+94 11 2789123',
    email: 'info@sierraltd.lk',
    address: 'No. 23, Asoka Gardens, Colombo 04',
    sourceProject: 'Water & Marine Projects',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-TUD05',
    name: 'Tudawe Brothers (Pvt) Ltd',
    type: 'Subcontractor',
    contactPerson: 'Mr. Jagath Tudawe',
    phone: '+94 11 2871092',
    email: 'contact@tudawe.com',
    address: 'No. 505/2, Elvitigala Mawatha, Colombo 05',
    sourceProject: 'Central Subcontractor Registry',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-SNK06',
    name: 'Sanken Construction (Pvt) Ltd',
    type: 'Subcontractor',
    contactPerson: 'Eng. Ravi Seneviratne',
    phone: '+94 11 2826733',
    email: 'info@sanken.lk',
    address: 'No. 295, Madampitiya Road, Colombo 14',
    sourceProject: 'Building Construction Division',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-ICC07',
    name: 'International Construction Consortium (ICC)',
    type: 'Subcontractor',
    contactPerson: 'Mr. Anura Fernando',
    phone: '+94 11 2868112',
    email: 'contracts@icc-construct.com',
    address: 'No. 70, S. De S. Jayasinghe Mawatha, Kohuwala',
    sourceProject: 'Highway Division Pool',
    rating: 'Tier-1 National',
  },
  {
    code: 'BP-VMC11',
    name: 'Venura Metal Crushers (Pvt) Ltd',
    type: 'Supplier',
    contactPerson: 'Mr. Venura Wickramatunga',
    phone: '+94 33 2289100',
    email: 'sales@venuracrushers.lk',
    address: 'Quarry Site, Kotadeniyawa, Mirigama',
    sourceProject: 'Central Expressway Project (CEP-02)',
    rating: 'Certified Quarry Supplier',
  },
  {
    code: 'BP-RBL12',
    name: 'Ranatunga Bar Benders Ltd',
    type: 'Labour Contractor',
    contactPerson: 'Mr. Sarath Ranatunga',
    phone: '+94 77 3489122',
    email: 'ranatunga.steelfix@gmail.com',
    address: 'No. 45, Kandy Road, Kadawatha',
    sourceProject: 'Central Labour Pool - Colombo',
    rating: 'Specialist Rebar Labour',
  },
  {
    code: 'BP-JSE13',
    name: 'Jayasiri Electrical & MEP Services',
    type: 'Specialist MEP',
    contactPerson: 'Eng. Jayasiri Bandara',
    phone: '+94 71 8920199',
    email: 'mep@jayasiri.lk',
    address: 'No. 18, High Level Road, Pannipitiya',
    sourceProject: 'Building Construction Division',
    rating: 'EM-1 Certified',
  },
];

// ── 3. Central Corporate Employee Register ────────────────────────────────────
export const CORPORATE_EMPLOYEES_CATALOG: CorporateEmployee[] = [
  {
    employeeCode: 'EMP-M0101',
    callingName: 'Sunil',
    fullName: 'Sunil Gamage',
    nicNo: '198523401928',
    tradeGroup: 'Carpentry',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Central Labour Pool - Colombo',
    dailyRate: 3500,
    epfNo: 'EPF-89211',
    skillLevel: 'Master Tradesman',
  },
  {
    employeeCode: 'EMP-M0102',
    callingName: 'Bandara',
    fullName: 'K.M. Bandara',
    nicNo: '199014502891',
    tradeGroup: 'Masonry',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Kandy Highway Phase 1',
    dailyRate: 3800,
    epfNo: 'EPF-74102',
    skillLevel: 'Skilled Grade 1',
  },
  {
    employeeCode: 'EMP-M0103',
    callingName: 'Kumara',
    fullName: 'L.A. Kumara',
    nicNo: '198276103429',
    tradeGroup: 'Steel Fixer',
    businessPartner: 'Sierra Construction (Pvt) Ltd',
    sourceProject: 'Central Expressway Project',
    dailyRate: 4200,
    epfNo: 'EPF-90234',
    skillLevel: 'Master Tradesman',
  },
  {
    employeeCode: 'EMP-M0104',
    callingName: 'Pradeep',
    fullName: 'Pradeep Wijeratne',
    nicNo: '199210904512',
    tradeGroup: 'Operator',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    dailyRate: 4800,
    epfNo: 'EPF-81092',
    skillLevel: 'Certified Heavy Operator',
  },
  {
    employeeCode: 'EMP-M0105',
    callingName: 'Nishantha',
    fullName: 'Nishantha Jayakody',
    nicNo: '198818205634',
    tradeGroup: 'Electrician',
    businessPartner: 'Access Engineering PLC',
    sourceProject: 'Colombo Port City Infrastructure',
    dailyRate: 4500,
    epfNo: 'EPF-65412',
    skillLevel: 'Skilled Grade 1',
  },
  {
    employeeCode: 'EMP-M0106',
    callingName: 'Mahesh',
    fullName: 'Mahesh Senaratne',
    nicNo: '198309104821',
    tradeGroup: 'Welder',
    businessPartner: 'Nawaloka Construction (Pvt) Ltd',
    sourceProject: 'Orugodawatta Flyover Project',
    dailyRate: 4600,
    epfNo: 'EPF-71902',
    skillLevel: '6G Certified Welder',
  },
  {
    employeeCode: 'EMP-M0107',
    callingName: 'Roshan',
    fullName: 'Roshan Wickramasinghe',
    nicNo: '199120409812',
    tradeGroup: 'Bar Bender',
    businessPartner: 'Ranatunga Bar Benders Ltd',
    sourceProject: 'Central Labour Pool - Colombo',
    dailyRate: 3600,
    epfNo: 'EPF-54819',
    skillLevel: 'Skilled Grade 2',
  },
  {
    employeeCode: 'EMP-M0108',
    callingName: 'Chaminda',
    fullName: 'Chaminda Rathnayake',
    nicNo: '198719203841',
    tradeGroup: 'Scaffolder',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Southern Expressway Project',
    dailyRate: 3900,
    epfNo: 'EPF-82914',
    skillLevel: 'Certified Scaffolder',
  },
  {
    employeeCode: 'EMP-M0109',
    callingName: 'Sanjeewa',
    fullName: 'Sanjeewa Alwis',
    nicNo: '198904102941',
    tradeGroup: 'Labour',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Central Labour Pool - Colombo',
    dailyRate: 3000,
    epfNo: 'EPF-91028',
    skillLevel: 'Semi-Skilled Field Labour',
  },
  {
    employeeCode: 'EMP-M0110',
    callingName: 'Dinesh',
    fullName: 'Dinesh Gunawardena',
    nicNo: '199329108421',
    tradeGroup: 'Operator',
    businessPartner: 'Mäga Engineering (Direct)',
    sourceProject: 'Central Equipment Yard - Peliyagoda',
    dailyRate: 5000,
    epfNo: 'EPF-49102',
    skillLevel: 'Tower Crane Certified',
  },
  {
    employeeCode: 'EMP-M0111',
    callingName: 'Ruwan',
    fullName: 'Ruwan Fernando',
    nicNo: '198610204911',
    tradeGroup: 'Carpentry',
    businessPartner: 'Tudawe Brothers (Pvt) Ltd',
    sourceProject: 'Kandy Highway Phase 1',
    dailyRate: 3700,
    epfNo: 'EPF-62910',
    skillLevel: 'Skilled Grade 1',
  },
  {
    employeeCode: 'EMP-M0112',
    callingName: 'Wasantha',
    fullName: 'Wasantha Abeykoon',
    nicNo: '198429103982',
    tradeGroup: 'Masonry',
    businessPartner: 'Sanken Construction (Pvt) Ltd',
    sourceProject: 'Building Construction Division',
    dailyRate: 4000,
    epfNo: 'EPF-78192',
    skillLevel: 'Master Tradesman',
  },
];

// ── 4. Central Corporate Activity Code / BOQ Master ───────────────────────────
export const CORPORATE_ACTIVITY_CATALOG: CorporateActivityCode[] = [
  {
    code: 'ACT-EW-01',
    description: 'Site clearing, grubbing and top soil removal up to 150mm depth',
    tradeGroup: 'Earthwork',
    unit: 'm²',
    sourceProject: 'Standard Specifications for Construction & Maintenance (SSCM)',
  },
  {
    code: 'ACT-EW-02',
    description: 'Excavation in common roadway material including loading and haulage up to 1km',
    tradeGroup: 'Earthwork',
    unit: 'm³',
    sourceProject: 'Highways Standard BOQ Master',
  },
  {
    code: 'ACT-EW-03',
    description: 'Excavation in hard rock requiring pneumatic breakers and controlled presplitting',
    tradeGroup: 'Earthwork',
    unit: 'm³',
    sourceProject: 'Highways Standard BOQ Master',
  },
  {
    code: 'ACT-CN-01',
    description: 'Mass concreting Grade 20 (20mm aggregate) for foundation blinding layers',
    tradeGroup: 'Concrete',
    unit: 'm³',
    sourceProject: 'ICTAD / CIDA Standard Specifications',
  },
  {
    code: 'ACT-CN-02',
    description: 'Reinforced structural concreting Grade 30 for bridge piers, abutments & deck slabs',
    tradeGroup: 'Concrete',
    unit: 'm³',
    sourceProject: 'ICTAD / CIDA Standard Specifications',
  },
  {
    code: 'ACT-CN-03',
    description: 'High performance self-compacting concrete Grade 40 for post-tensioned bridge girders',
    tradeGroup: 'Concrete',
    unit: 'm³',
    sourceProject: 'Highways Standard BOQ Master',
  },
  {
    code: 'ACT-FW-01',
    description: 'Marine plywood formwork with steel props and bracing for vertical columns & walls',
    tradeGroup: 'Formwork',
    unit: 'm²',
    sourceProject: 'Building Works Standard BOQ',
  },
  {
    code: 'ACT-FW-02',
    description: 'Curved and cantilever soffit formwork for bridge overhangs and elevated deck slabs',
    tradeGroup: 'Formwork',
    unit: 'm²',
    sourceProject: 'Highways Standard BOQ Master',
  },
  {
    code: 'ACT-ST-01',
    description: 'Cutting, bending, bundling and placing High Yield Deformed steel bars (T16-T32)',
    tradeGroup: 'Steel Fixer',
    unit: 'kg',
    sourceProject: 'ICTAD / CIDA Standard Specifications',
  },
  {
    code: 'ACT-ST-02',
    description: 'Coupler threading, mechanical splicing and fixing of heavy foundation cage rebar',
    tradeGroup: 'Steel Fixer',
    unit: 'item',
    sourceProject: 'ICTAD / CIDA Standard Specifications',
  },
  {
    code: 'ACT-MS-01',
    description: '9 inch Brick masonry in cement mortar 1:5 for load-bearing and retaining structures',
    tradeGroup: 'Masonry',
    unit: 'm²',
    sourceProject: 'Building Works Standard BOQ',
  },
  {
    code: 'ACT-PL-01',
    description: 'Internal and external smooth finish cement-sand plastering 16mm thick with lime wash',
    tradeGroup: 'Plastering',
    unit: 'm²',
    sourceProject: 'Building Works Standard BOQ',
  },
  {
    code: 'ACT-RD-01',
    description: 'Supply, laying and heavy pneumatic compaction of Dense Bituminous Macadam (DBM) 60mm',
    tradeGroup: 'Road Works',
    unit: 'm²',
    sourceProject: 'Standard Specifications for Construction & Maintenance (SSCM)',
  },
  {
    code: 'ACT-RD-02',
    description: 'Laying and finishing of Asphalt Concrete Wearing Course 40mm thick with asphalt paver',
    tradeGroup: 'Road Works',
    unit: 'm²',
    sourceProject: 'Standard Specifications for Construction & Maintenance (SSCM)',
  },
  {
    code: 'ACT-DR-01',
    description: 'Laying and jointing of 900mm dia Reinforced Concrete Hume Pipes for cross drainage',
    tradeGroup: 'Drainage',
    unit: 'lin.m',
    sourceProject: 'Highways Standard BOQ Master',
  },
  {
    code: 'ACT-MP-01',
    description: 'Installation of perforated cable trays, earthing busbars and conduit raceways for MEP',
    tradeGroup: 'MEP',
    unit: 'lin.m',
    sourceProject: 'Building Works Standard BOQ',
  },
];

// Helper to get unique source projects across a list
export function getUniqueSourceProjects(items: { sourceProject: string }[]): string[] {
  return Array.from(new Set(items.map((i) => i.sourceProject))).filter(Boolean).sort();
}

// Helper to get unique categories/trade groups
export function getUniqueCategories(items: { type?: string; tradeGroup?: string }[]): string[] {
  return Array.from(
    new Set(items.map((i) => i.type || i.tradeGroup || '').filter(Boolean))
  ).sort();
}
