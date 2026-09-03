/**
 * employeeService.ts
 *
 * Mock service for employee CRUD. In-memory data scoped to tenant-001
 * (Mäga Engineering). All functions simulate network delay.
 *
 * TODO: Replace each function body with real API calls:
 *   getAll()     → GET    /api/employees
 *   getById(id)  → GET    /api/employees/:id
 *   create(data) → POST   /api/employees
 *   update(data) → PUT    /api/employees/:id
 *   deactivate() → PATCH  /api/employees/:id/status
 */

export interface Employee {
  id: string;
  employeeCode?: string;
  callingName: string;
  fullName: string;
  businessPartner: string;
  tradeGroup: string;
  nicNo: string;
  dailyRate?: number;
  epfNo?: string;
  status: 'active' | 'inactive';
}

export interface EmployeeFormData {
  employeeCode?: string;
  callingName?: string;
  fullName?: string;
  businessPartner: string;
  tradeGroup: string;
  nicNo: string;
  dailyRate: number;
  epfNo?: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextId = 999;

const EMPLOYEES: Employee[] = [
  // ── Site Labour Details (from Master Labour List) ───────────────────────────
  { id: 'HK030', employeeCode: 'HK030', callingName: 'HK030', fullName: 'Lab Helper HK030', businessPartner: 'Maga', tradeGroup: 'Lab Helper', nicNo: '961173612V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK031', employeeCode: 'HK031', callingName: 'HK031', fullName: 'Lab Helper HK031', businessPartner: 'Maga', tradeGroup: 'Lab Helper', nicNo: '200531503866', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HI258', employeeCode: 'HI258', callingName: 'HI258', fullName: 'Cook HI258', businessPartner: 'Maga', tradeGroup: 'Cook', nicNo: '197235100210', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK032', employeeCode: 'HK032', callingName: 'HK032', fullName: 'Helper HK032', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200307101128', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK033', employeeCode: 'HK033', callingName: 'HK033', fullName: 'Helper HK033', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200635000602', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK034', employeeCode: 'HK034', callingName: 'HK034', fullName: 'Helper HK034', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '922513082V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK035', employeeCode: 'HK035', callingName: 'HK035', fullName: 'Helper HK035', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200130701719', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HI911', employeeCode: 'HI911', callingName: 'HI911', fullName: 'Helper HI911', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '950082836V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HI265', employeeCode: 'HI265', callingName: 'HI265', fullName: 'Helper HI265', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '710734364V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK121', employeeCode: 'HK121', callingName: 'HK121', fullName: 'Helper HK121', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '921853670V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK122', employeeCode: 'HK122', callingName: 'HK122', fullName: 'Helper HK122', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '198212803752', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK123', employeeCode: 'HK123', callingName: 'HK123', fullName: 'Helper HK123', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '198709902610', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK124', employeeCode: 'HK124', callingName: 'HK124', fullName: 'Charge Hand HK124', businessPartner: 'Maga', tradeGroup: 'Charge Hand', nicNo: '982990386V', dailyRate: 1600.00, epfNo: '', status: 'active' },
  { id: 'HI394', employeeCode: 'HI394', callingName: 'HI394', fullName: 'Carpentor HI394', businessPartner: 'Maga', tradeGroup: 'Carpentor', nicNo: '853454435V', dailyRate: 1600.00, epfNo: '', status: 'active' },
  { id: 'HK947', employeeCode: 'HK947', callingName: 'HK947', fullName: 'Helper HK947', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200607304610', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HL056', employeeCode: 'HL056', callingName: 'HL056', fullName: 'Helper HL056', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200800501773', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HK948', employeeCode: 'HK948', callingName: 'HK948', fullName: 'Helper HK948', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '892215006V', dailyRate: 1400.00, epfNo: '', status: 'active' },
  { id: 'HL057', employeeCode: 'HL057', callingName: 'HL057', fullName: 'Helper HL057', businessPartner: 'Maga', tradeGroup: 'Helper', nicNo: '200421204651', dailyRate: 1400.00, epfNo: '', status: 'active' },
  // ── Masons (100 Series) ───────────────────────────────────────────────────
  { id: 'HI101', callingName: '101', fullName: 'Kamal Perera',            businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '881234567V', status: 'active' },
  { id: 'HI102', callingName: '102', fullName: 'Lakmal Dissanayake',      businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '891234573V', status: 'active' },
  { id: 'HI103', callingName: '103', fullName: 'Sampath Ranasinghe',      businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '871234579V', status: 'active' },
  { id: 'HI104', callingName: '104', fullName: 'Mahesh Jayasundara',      businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '921234585V', status: 'active' },
  { id: 'HI105', callingName: '105', fullName: 'Lasantha Peiris',         businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '851234592V', status: 'active' },
  { id: 'HI106', callingName: '106', fullName: 'Sanjeewa Athukorala',     businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '841234600V', status: 'active' },
  { id: 'HI107', callingName: '107', fullName: 'Sarath Edirisinghe',      businessPartner: 'Alpha Constructions', tradeGroup: 'Mason',          nicNo: '821234605V', status: 'active' },
  { id: 'HI108', callingName: '108', fullName: 'Sisira Weerakoon',        businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '861234612V', status: 'active' },
  { id: 'HI109', callingName: '109', fullName: 'Priyadarshana Boteju',    businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '921234621V', status: 'active' },
  { id: 'HI110', callingName: '110', fullName: 'Dananjaya Lakshan',       businessPartner: 'Alpha Constructions', tradeGroup: 'Mason',          nicNo: '981234629V', status: 'active' },
  { id: 'HI111', callingName: '111', fullName: 'Praveen Jayawickrama',    businessPartner: 'Alpha Constructions', tradeGroup: 'Mason',          nicNo: '981234638V', status: 'active' },
  { id: 'HI112', callingName: '112', fullName: 'Nuwan Thushara',          businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '941234649V', status: 'active' },
  { id: 'HI113', callingName: '113', fullName: 'Channa Vithanage',        businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '891234660V', status: 'active' },
  { id: 'HI114', callingName: '114', fullName: 'Bandula Warnasuriya',     businessPartner: 'Alpha Constructions', tradeGroup: 'Mason',          nicNo: '831234667V', status: 'active' },
  { id: 'HI115', callingName: '115', fullName: 'Dhammika Prasad',         businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '871234668V', status: 'inactive' },

  // ── Carpenters (200 Series) ───────────────────────────────────────────────
  { id: 'HI201', callingName: '201', fullName: 'Nimal Silva',             businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '901234568V', status: 'active' },
  { id: 'HI202', callingName: '202', fullName: 'Asanka Kumara',           businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '941234574V', status: 'active' },
  { id: 'HI203', callingName: '203', fullName: 'Ajith Mendis',            businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter',      nicNo: '841234581V', status: 'active' },
  { id: 'HI204', callingName: '204', fullName: 'Gayan Karunaratne',       businessPartner: 'Beta Projects',       tradeGroup: 'Carpenter',      nicNo: '901234589V', status: 'active' },
  { id: 'HI205', callingName: '205', fullName: 'Duminda De Silva',        businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter',      nicNo: '871234596V', status: 'active' },
  { id: 'HI206', callingName: '206', fullName: 'Jagath Kulatunga',        businessPartner: 'Beta Projects',       tradeGroup: 'Carpenter',      nicNo: '881234604V', status: 'active' },
  { id: 'HI207', callingName: '207', fullName: 'Dayan Jayatillake',       businessPartner: 'Beta Projects',       tradeGroup: 'Carpenter',      nicNo: '931234613V', status: 'active' },
  { id: 'HI208', callingName: '208', fullName: 'Kusal Mendis',            businessPartner: 'Beta Projects',       tradeGroup: 'Carpenter',      nicNo: '951234622V', status: 'active' },
  { id: 'HI209', callingName: '209', fullName: 'Avishka Fernando',        businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '981234630V', status: 'active' },
  { id: 'HI210', callingName: '210', fullName: 'Binura Fernando',         businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '951234639V', status: 'active' },
  { id: 'HI211', callingName: '211', fullName: 'Sachith Pathirana',       businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter',      nicNo: '891234650V', status: 'active' },
  { id: 'HI212', callingName: '212', fullName: 'Samantha Lokuge',         businessPartner: 'Beta Projects',       tradeGroup: 'Carpenter',      nicNo: '851234661V', status: 'active' },

  // ── Electricians (300 Series) ─────────────────────────────────────────────
  { id: 'HI301', callingName: '301', fullName: 'Sunil Fernando',          businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '851234569V', status: 'active' },
  { id: 'HI302', callingName: '302', fullName: 'Dinesh Wickramasinghe',   businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '861234575V', status: 'active' },
  { id: 'HI303', callingName: '303', fullName: 'Dhanushka Gamage',        businessPartner: 'Maga Engineering',    tradeGroup: 'Electrician',    nicNo: '861234588V', status: 'active' },
  { id: 'HI304', callingName: '304', fullName: 'Sameera Pathirana',       businessPartner: 'Beta Projects',       tradeGroup: 'Electrician',    nicNo: '911234595V', status: 'active' },
  { id: 'HI305', callingName: '305', fullName: 'Priyantha Tennakoon',     businessPartner: 'Beta Projects',       tradeGroup: 'Electrician',    nicNo: '891234607V', status: 'active' },
  { id: 'HI306', callingName: '306', fullName: 'Kapila Basnayake',        businessPartner: 'Maga Engineering',    tradeGroup: 'Electrician',    nicNo: '901234615V', status: 'active' },
  { id: 'HI307', callingName: '307', fullName: 'Sahan Arachchige',        businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '941234626V', status: 'inactive' },
  { id: 'HI308', callingName: '308', fullName: 'Dhananjaya De Silva',     businessPartner: 'Beta Projects',       tradeGroup: 'Electrician',    nicNo: '911234637V', status: 'active' },
  { id: 'HI309', callingName: '309', fullName: 'Kasun Rajitha',           businessPartner: 'Maga Engineering',    tradeGroup: 'Electrician',    nicNo: '931234648V', status: 'active' },
  { id: 'HI310', callingName: '310', fullName: 'Thusitha Mudalige',       businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '861234659V', status: 'active' },
  { id: 'HI311', callingName: '311', fullName: 'Indrajith Jayasena',      businessPartner: 'Maga Engineering',    tradeGroup: 'Electrician',    nicNo: '881234669V', status: 'active' },

  // ── Welders (400 Series) ──────────────────────────────────────────────────
  { id: 'HI401', callingName: '401', fullName: 'Pradeep Bandara',         businessPartner: 'Maga Engineering',    tradeGroup: 'Welder',         nicNo: '931234572V', status: 'active' },
  { id: 'HI402', callingName: '402', fullName: 'Nuwan Samaraweera',       businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '911234578V', status: 'inactive' },
  { id: 'HI403', callingName: '403', fullName: 'Isuru Weerasinghe',       businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '941234590V', status: 'active' },
  { id: 'HI404', callingName: '404', fullName: 'Sandun Kariyawasam',      businessPartner: 'Beta Projects',       tradeGroup: 'Welder',         nicNo: '891234598V', status: 'active' },
  { id: 'HI405', callingName: '405', fullName: 'Rohana Senaratne',        businessPartner: 'Beta Projects',       tradeGroup: 'Welder',         nicNo: '871234610V', status: 'active' },
  { id: 'HI406', callingName: '406', fullName: 'Dimuth Karunaratne',      businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '881234623V', status: 'active' },
  { id: 'HI407', callingName: '407', fullName: 'Pathum Nissanka',         businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '981234632V', status: 'active' },
  { id: 'HI408', callingName: '408', fullName: 'Milan Rathnayake',        businessPartner: 'Maga Engineering',    tradeGroup: 'Welder',         nicNo: '961234642V', status: 'active' },
  { id: 'HI409', callingName: '409', fullName: 'Chamara Silva',           businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '791234653V', status: 'active' },
  { id: 'HI410', callingName: '410', fullName: 'Thilina Kandamby',        businessPartner: 'Beta Projects',       tradeGroup: 'Welder',         nicNo: '821234664V', status: 'inactive' },
  { id: 'HI411', callingName: '411', fullName: 'Maduranga Fonseka',       businessPartner: 'Maga Engineering',    tradeGroup: 'Welder',         nicNo: '921234670V', status: 'active' },

  // ── Plumbers (500 Series) ─────────────────────────────────────────────────
  { id: 'HI501', callingName: '501', fullName: 'Ruwan Jayawardena',       businessPartner: 'Beta Projects',       tradeGroup: 'Plumber',        nicNo: '871234571V', status: 'active' },
  { id: 'HI502', callingName: '502', fullName: 'Tharanga Abeysekara',     businessPartner: 'Maga Engineering',    tradeGroup: 'Plumber',        nicNo: '881234577V', status: 'active' },
  { id: 'HI503', callingName: '503', fullName: 'Supun Alwis',             businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber',        nicNo: '971234587V', status: 'active' },
  { id: 'HI504', callingName: '504', fullName: 'Kavinda Jayamaha',        businessPartner: 'Maga Engineering',    tradeGroup: 'Plumber',        nicNo: '961234597V', status: 'active' },
  { id: 'HI505', callingName: '505', fullName: 'Mahinda Jayakody',        businessPartner: 'Maga Engineering',    tradeGroup: 'Plumber',        nicNo: '841234609V', status: 'active' },
  { id: 'HI506', callingName: '506', fullName: 'Shantha Samarasekera',    businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber',        nicNo: '841234620V', status: 'active' },
  { id: 'HI507', callingName: '507', fullName: 'Wanindu Hasaranga',       businessPartner: 'Beta Projects',       tradeGroup: 'Plumber',        nicNo: '971234631V', status: 'active' },
  { id: 'HI508', callingName: '508', fullName: 'Nuwanidu Fernando',       businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber',        nicNo: '991234641V', status: 'active' },
  { id: 'HI509', callingName: '509', fullName: 'Suranga Lakmal',          businessPartner: 'Beta Projects',       tradeGroup: 'Plumber',        nicNo: '871234562V', status: 'active' },
  { id: 'HI510', callingName: '510', fullName: 'Senaka Dias',             businessPartner: 'Maga Engineering',    tradeGroup: 'Plumber',        nicNo: '881234663V', status: 'active' },
  { id: 'HI511', callingName: '511', fullName: 'Chinthaka Jayasinghe',    businessPartner: 'Alpha Constructions', tradeGroup: 'Plumber',        nicNo: '811234671V', status: 'active' },
  { id: 'HI512', callingName: '512', fullName: 'Ruwantha Kumara',         businessPartner: 'Beta Projects',       tradeGroup: 'Plumber',        nicNo: '951234672V', status: 'active' },

  // ── General Labour (600 Series) ───────────────────────────────────────────
  { id: 'HI601', callingName: '601', fullName: 'Chaminda Rajapakse',      businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '921234570V', status: 'active' },
  { id: 'HI602', callingName: '602', fullName: 'Roshan Gunawardena',      businessPartner: 'Beta Projects',       tradeGroup: 'General labour', nicNo: '951234576V', status: 'active' },
  { id: 'HI603', callingName: '603', fullName: 'Udara Liyanage',          businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '961234580V', status: 'active' },
  { id: 'HI604', callingName: '604', fullName: 'Lahiru Cooray',           businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '981234591V', status: 'active' },
  { id: 'HI605', callingName: '605', fullName: 'Harsha Wickramaratne',    businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '921234599V', status: 'active' },
  { id: 'HI606', callingName: '606', fullName: 'Gamini Ekanayake',        businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '811234608V', status: 'inactive' },
  { id: 'HI607', callingName: '607', fullName: 'Ranjith Herath',          businessPartner: 'Beta Projects',       tradeGroup: 'General labour', nicNo: '851234616V', status: 'active' },
  { id: 'HI608', callingName: '608', fullName: 'Malith Madushanka',       businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '971234627V', status: 'active' },
  { id: 'HI609', callingName: '609', fullName: 'Dunith Wellalage',        businessPartner: 'Beta Projects',       tradeGroup: 'General labour', nicNo: '20031234643V', status: 'active' },
  { id: 'HI610', callingName: '610', fullName: 'Navod Paranavithana',     businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '20021234654V', status: 'active' },
  { id: 'HI611', callingName: '611', fullName: 'Dilshan Munaweera',       businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '891234665V', status: 'active' },
  { id: 'HI612', callingName: '612', fullName: 'Asitha Fernando',         businessPartner: 'Beta Projects',       tradeGroup: 'General labour', nicNo: '971234673V', status: 'active' },
  { id: 'HI613', callingName: '613', fullName: 'Nuwan Pradeep',           businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '861234674V', status: 'active' },
  { id: 'HI614', callingName: '614', fullName: 'Sahan Sandaruwan',        businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '991234675V', status: 'active' },
  { id: 'HI678', callingName: '678', fullName: 'Anura Hettiarachchi',     businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '911234676V', status: 'active' },

  // ── Bar Benders (700 Series) ──────────────────────────────────────────────
  { id: 'HI701', callingName: '701', fullName: 'Kasun Fonseka',           businessPartner: 'Maga Engineering',    tradeGroup: 'Bar Bender',     nicNo: '912345682V', status: 'active' },
  { id: 'HI702', callingName: '702', fullName: 'Chathura Nanayakkara',    businessPartner: 'Maga Engineering',    tradeGroup: 'Bar Bender',     nicNo: '931234594V', status: 'inactive' },
  { id: 'HI703', callingName: '703', fullName: 'Wasantha Samarawickrama', businessPartner: 'Maga Engineering',    tradeGroup: 'Bar Bender',     nicNo: '851234606V', status: 'active' },
  { id: 'HI704', callingName: '704', fullName: 'Sumith Ilangakoon',       businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender',     nicNo: '891234617V', status: 'active' },
  { id: 'HI705', callingName: '705', fullName: 'Charith Asalanka',        businessPartner: 'Beta Projects',       tradeGroup: 'Bar Bender',     nicNo: '971234628V', status: 'active' },
  { id: 'HI706', callingName: '706', fullName: 'Pramod Madushan',         businessPartner: 'Beta Projects',       tradeGroup: 'Bar Bender',     nicNo: '931234640V', status: 'active' },
  { id: 'HI707', callingName: '707', fullName: 'Lahiru Madushanka',       businessPartner: 'Maga Engineering',    tradeGroup: 'Bar Bender',     nicNo: '921234651V', status: 'active' },
  { id: 'HI708', callingName: '708', fullName: 'Kumara Dharmasena',       businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender',     nicNo: '711234662V', status: 'active' },
  { id: 'HI709', callingName: '709', fullName: 'Hirantha Jayalath',       businessPartner: 'Alpha Constructions', tradeGroup: 'Bar Bender',     nicNo: '901234677V', status: 'active' },
  { id: 'HI710', callingName: '710', fullName: 'Viraj Wickramasinghe',     businessPartner: 'Beta Projects',       tradeGroup: 'Bar Bender',     nicNo: '881234678V', status: 'active' },

  // ── Painters (800 Series) ─────────────────────────────────────────────────
  { id: 'HI801', callingName: '801', fullName: 'Bandara Senanayake',      businessPartner: 'Beta Projects',       tradeGroup: 'Painter',        nicNo: '831234583V', status: 'active' },
  { id: 'HI802', callingName: '802', fullName: 'Anura Premaratne',        businessPartner: 'Alpha Constructions', tradeGroup: 'Painter',        nicNo: '831234602V', status: 'active' },
  { id: 'HI803', callingName: '803', fullName: 'Neville Wijeratne',       businessPartner: 'Maga Engineering',    tradeGroup: 'Painter',        nicNo: '821234618V', status: 'active' },
  { id: 'HI804', callingName: '804', fullName: 'Dasun Shanaka',           businessPartner: 'Beta Projects',       tradeGroup: 'Painter',        nicNo: '911234634V', status: 'active' },
  { id: 'HI805', callingName: '805', fullName: 'Dushan Hemantha',         businessPartner: 'Alpha Constructions', tradeGroup: 'Painter',        nicNo: '941234644V', status: 'inactive' },
  { id: 'HI806', callingName: '806', fullName: 'Sandeep Shaminda',        businessPartner: 'Alpha Constructions', tradeGroup: 'Painter',        nicNo: '961234656V', status: 'active' },

  // ── Steel Fixers, Scaffolders & Tile Layers (900 Series) ──────────────────
  { id: 'HI901', callingName: '901', fullName: 'Janaka Wijesinghe',       businessPartner: 'Alpha Constructions', tradeGroup: 'Steel Fixer',    nicNo: '891234584V', status: 'active' },
  { id: 'HI902', callingName: '902', fullName: 'Sajith Rathnayake',       businessPartner: 'Beta Projects',       tradeGroup: 'Scaffolder',     nicNo: '951234586V', status: 'active' },
  { id: 'HI903', callingName: '903', fullName: 'Manjula Hettiarachchi',   businessPartner: 'Alpha Constructions', tradeGroup: 'Tile Layer',     nicNo: '881234593V', status: 'active' },
  { id: 'HI904', callingName: '904', fullName: 'Indika Munasinghe',       businessPartner: 'Beta Projects',       tradeGroup: 'Steel Fixer',    nicNo: '901234601V', status: 'active' },
  { id: 'HI905', callingName: '905', fullName: 'Lalith Warnakulasooriya', businessPartner: 'Maga Engineering',    tradeGroup: 'Scaffolder',     nicNo: '861234603V', status: 'active' },
  { id: 'HI906', callingName: '906', fullName: 'Upul Chandrasena',        businessPartner: 'Alpha Constructions', tradeGroup: 'Tile Layer',     nicNo: '911234611V', status: 'active' },
  { id: 'HI907', callingName: '907', fullName: 'Ravindra Seneviratne',    businessPartner: 'Alpha Constructions', tradeGroup: 'Steel Fixer',    nicNo: '881234614V', status: 'active' },
  { id: 'HI908', callingName: '908', fullName: 'Jayantha Jayalath',       businessPartner: 'Beta Projects',       tradeGroup: 'Scaffolder',     nicNo: '871234619V', status: 'active' },
];

// ── Service functions ─────────────────────────────────────────────────────────

export async function getAll(): Promise<Employee[]> {
  await delay(300);
  return EMPLOYEES.map((e) => ({
    ...e,
    employeeCode: e.employeeCode || e.id,
    dailyRate: e.dailyRate !== undefined ? e.dailyRate : 1400,
    epfNo: e.epfNo ?? '',
  }));
}

export async function getById(id: string): Promise<Employee | undefined> {
  await delay(200);
  const emp = EMPLOYEES.find((e) => e.id === id);
  if (!emp) return undefined;
  return {
    ...emp,
    employeeCode: emp.employeeCode || emp.id,
    dailyRate: emp.dailyRate !== undefined ? emp.dailyRate : 1400,
    epfNo: emp.epfNo ?? '',
  };
}

export async function create(data: EmployeeFormData): Promise<Employee> {
  await delay(400);
  const code = data.employeeCode || (data.callingName ? `HI${data.callingName}` : `HI${String(nextId++).padStart(3, '0')}`);
  const emp: Employee = {
    id: code,
    employeeCode: code,
    callingName: data.callingName || code,
    fullName: data.fullName || code,
    businessPartner: data.businessPartner || 'Maga',
    tradeGroup: data.tradeGroup || 'General labour',
    nicNo: data.nicNo || '',
    dailyRate: data.dailyRate !== undefined ? Number(data.dailyRate) : 1400,
    epfNo: data.epfNo || '',
    status: 'active',
  };
  EMPLOYEES.push(emp);
  return emp;
}

export async function update(id: string, data: Partial<EmployeeFormData>): Promise<Employee> {
  await delay(400);
  const idx = EMPLOYEES.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Employee not found');
  EMPLOYEES[idx] = {
    ...EMPLOYEES[idx],
    ...data,
    employeeCode: data.employeeCode || EMPLOYEES[idx].employeeCode || EMPLOYEES[idx].id,
    dailyRate: data.dailyRate !== undefined ? Number(data.dailyRate) : (EMPLOYEES[idx].dailyRate ?? 1400),
    epfNo: data.epfNo !== undefined ? data.epfNo : (EMPLOYEES[idx].epfNo ?? ''),
  };
  return EMPLOYEES[idx];
}

export async function deactivate(id: string): Promise<Employee> {
  await delay(300);
  const idx = EMPLOYEES.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Employee not found');
  EMPLOYEES[idx].status = 'inactive';
  return EMPLOYEES[idx];
}

/** Unique business partners for filter dropdowns */
export function getBusinessPartners(): string[] {
  return [...new Set(EMPLOYEES.map((e) => e.businessPartner))].sort();
}

/** Unique trade groups for filter dropdowns */
export function getTradeGroups(): string[] {
  return [...new Set(EMPLOYEES.map((e) => e.tradeGroup))].sort();
}
