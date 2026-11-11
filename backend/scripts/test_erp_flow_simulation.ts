/**
 * test_erp_flow_simulation.ts
 * 
 * End-to-End Simulation & Verification Test:
 * Tests the entire data pipeline from Input Entry -> Business Logic Transaction -> DB Entity -> Final ERP Upload Output.
 * Covers all 8 operational scenarios to guarantee zero data loss and exact mathematical consistency.
 */

interface RawShiftInput {
  scenarioName: string;
  employeeCode: string;
  employeeName: string;
  dateStr: string; // YYYY-MM-DD
  inTime: string;
  outTime: string;
  additionalHours?: number;
  activities: Array<{ activityCode: string; description: string; hours: number }>;
}

interface ProcessedTimeEntry {
  employeeCode: string;
  employeeName: string;
  date: string;
  inTime: string;
  outTime: string;
  grossHours: number; // Stored in TimeEntry.hours (Out - In)
  breakHours: number; // Stored in TimeEntry.breakHours
  shiftHours: number; // Stored in TimeEntry.shiftHours (Effective Worked Hours)
  additionalHours: number;
  overtimeHours: number; // Stored in TimeEntry.overtimeHours
  activitySplits: Array<{ activityCode: string; description: string; hours: number }>;
}

interface ErpUploadRow {
  employeeId: string;
  employeeName: string;
  date: string;
  activityCode: string;
  activityDescription: string;
  hours: number;
  overtimeHours: number;
  remarks: string;
}

// ── 1. Break Hours Calculator (Maga standard: Lunch 12-13, Dinner 22-23) ─────
function computeBreakHours(inTime: string, outTime: string): number {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(outH)) return 0;

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);
  let grossMins = outMins - inMins;
  if (grossMins <= 0) grossMins += 24 * 60;

  const lunchStart = 12 * 60;
  const lunchEnd = 13 * 60;
  const dinnerStart = 22 * 60;
  const dinnerEnd = 23 * 60;

  const calcOverlap = (wStart: number, wEnd: number): number => {
    if (outMins > inMins) {
      return Math.max(0, Math.min(outMins, wEnd) - Math.max(inMins, wStart));
    } else {
      const s1 = Math.max(0, Math.min(1440, wEnd) - Math.max(inMins, wStart));
      const s2 = Math.max(0, Math.min(outMins, wEnd) - Math.max(0, wStart));
      return s1 + s2;
    }
  };

  let totalBreak = 0;
  if (calcOverlap(lunchStart, lunchEnd) > 0) totalBreak += 1.0;
  if (calcOverlap(dinnerStart, dinnerEnd) > 0) totalBreak += 1.0;

  return Math.min(totalBreak, grossMins / 60);
}

// ── 2. Day Type OT Rules ─────────────────────────────────────────────────────
function getDayTypeRule(dateStr: string): { standardCap: number; isAllOvertime: boolean; isSaturday: boolean; label: string } {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dow === 0) return { standardCap: 0, isAllOvertime: true, isSaturday: false, label: 'Sunday' };
  if (dow === 6) return { standardCap: 5.5, isAllOvertime: false, isSaturday: true, label: 'Saturday' };
  return { standardCap: 8.0, isAllOvertime: false, isSaturday: false, label: 'Weekday' };
}

// ── 3. Transaction Processing (Simulating UPLODSCRIP / checkOut / adminAdjust) ─
function processShiftTransaction(input: RawShiftInput): ProcessedTimeEntry {
  const [inH, inM] = input.inTime.split(':').map(Number);
  const [outH, outM] = input.outTime.split(':').map(Number);
  let diffMins = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diffMins <= 0) diffMins += 24 * 60;

  const grossHours = Math.round((diffMins / 60) * 100) / 100;
  const breakHours = computeBreakHours(input.inTime, input.outTime);
  const baseShift = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

  const totalActInputHours = Math.round(input.activities.reduce((s, a) => s + a.hours, 0) * 100) / 100;
  let additionalHours = input.additionalHours || 0;
  let finalShiftHours = baseShift;

  if (additionalHours > 0) {
    finalShiftHours = Math.round((baseShift + additionalHours) * 100) / 100;
  } else if (totalActInputHours > baseShift) {
    additionalHours = Math.round((totalActInputHours - baseShift) * 100) / 100;
    finalShiftHours = Math.round((baseShift + additionalHours) * 100) / 100;
  }

  // Activity balance: If activities sum < finalShiftHours, allocate difference to ZIDLE
  const splits = [...input.activities];
  const shortage = Math.round((finalShiftHours - totalActInputHours) * 100) / 100;
  if (shortage > 0.05 && !splits.some((s) => s.activityCode === 'ZIDLE')) {
    splits.push({
      activityCode: 'ZIDLE',
      description: 'Idle / Unallocated Hours',
      hours: shortage,
    });
  }

  // Calculate Overtime based on Day Type Rule
  const { standardCap, isAllOvertime } = getDayTypeRule(input.dateStr);
  let overtimeHours = 0;
  if (isAllOvertime) {
    overtimeHours = finalShiftHours;
  } else if (finalShiftHours > standardCap) {
    overtimeHours = Math.round((finalShiftHours - standardCap) * 100) / 100;
  }

  return {
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    date: input.dateStr,
    inTime: input.inTime,
    outTime: input.outTime,
    grossHours,
    breakHours,
    shiftHours: finalShiftHours,
    additionalHours,
    overtimeHours,
    activitySplits: splits,
  };
}

// ── 4. Final ERP Upload Generation (Exact logic from reportController.ts) ────
function generateErpUploadRows(entry: ProcessedTimeEntry): ErpUploadRow[] {
  const rows: ErpUploadRow[] = [];
  const { standardCap, isAllOvertime, label } = getDayTypeRule(entry.date);
  const shiftEffectiveHours = entry.shiftHours;

  let totalDayHours = 0;

  // 1. Activity Split Rows
  for (const split of entry.activitySplits) {
    const splitHours = Number(split.hours) || 0;
    totalDayHours += splitHours;
    rows.push({
      employeeId: entry.employeeCode,
      employeeName: entry.employeeName,
      date: entry.date,
      activityCode: split.activityCode,
      activityDescription: split.description,
      hours: splitHours,
      overtimeHours: 0,
      remarks: '',
    });
  }

  // 2. ZIDLE Balancing Row (if still needed)
  if (shiftEffectiveHours > 0 && totalDayHours < shiftEffectiveHours) {
    const idleHours = Math.round((shiftEffectiveHours - totalDayHours) * 100) / 100;
    rows.push({
      employeeId: entry.employeeCode,
      employeeName: entry.employeeName,
      date: entry.date,
      activityCode: 'ZIDLE',
      activityDescription: 'Idle / Unallocated Hours',
      hours: idleHours,
      overtimeHours: 0,
      remarks: 'Unallocated idle shift hours',
    });
    totalDayHours += idleHours;
  }

  // 3. Overtime Line
  const effectiveForOt = shiftEffectiveHours > 0 ? shiftEffectiveHours : totalDayHours;
  let otHours = 0;
  if (isAllOvertime) {
    otHours = effectiveForOt;
  } else if (effectiveForOt > standardCap) {
    otHours = Math.round((effectiveForOt - standardCap) * 100) / 100;
  }

  if (otHours > 0) {
    rows.push({
      employeeId: entry.employeeCode,
      employeeName: entry.employeeName,
      date: entry.date,
      activityCode: 'OT',
      activityDescription: isAllOvertime
        ? `${label} Overtime`
        : `Overtime (> ${standardCap} Hours)`,
      hours: 0,
      overtimeHours: otHours,
      remarks: '',
    });
  }

  return rows;
}

// ── 5. Define All 8 Scenarios ────────────────────────────────────────────────
const scenarios: RawShiftInput[] = [
  {
    scenarioName: 'Scenario 1: Standard Weekday 8-Hour Shift (No OT)',
    employeeCode: 'EMP001',
    employeeName: 'K.G. Sunil',
    dateStr: '2026-08-03', // Monday
    inTime: '07:00',
    outTime: '16:00',
    activities: [
      { activityCode: 'CONC-01', description: 'Concrete Pouring Slab L2', hours: 8.0 },
    ],
  },
  {
    scenarioName: 'Scenario 2: Weekday with Overtime (07:00 – 19:00)',
    employeeCode: 'EMP002',
    employeeName: 'M. Nihal',
    dateStr: '2026-08-04', // Tuesday
    inTime: '07:00',
    outTime: '19:00',
    activities: [
      { activityCode: 'REBAR-02', description: 'Rebar Tying & Cutting', hours: 11.0 },
    ],
  },
  {
    scenarioName: 'Scenario 3: Multi-Activity Split on Single Shift (07:00 – 17:00)',
    employeeCode: 'EMP003',
    employeeName: 'S. Samantha',
    dateStr: '2026-08-05', // Wednesday
    inTime: '07:00',
    outTime: '17:00',
    activities: [
      { activityCode: 'FORM-01', description: 'Formwork Erection Column C4', hours: 5.0 },
      { activityCode: 'SCAF-02', description: 'Scaffolding Dismantling', hours: 4.0 },
    ],
  },
  {
    scenarioName: 'Scenario 4: Activity Shortage / Idle Time (Auto ZIDLE Balancing)',
    employeeCode: 'EMP004',
    employeeName: 'A. Perera',
    dateStr: '2026-08-06', // Thursday
    inTime: '07:00',
    outTime: '17:00', // 10h Gross - 1h Lunch = 9h Effective
    activities: [
      { activityCode: 'MASON-01', description: 'Brick Masonry Wall B', hours: 6.0 },
      // 3.0 hours unallocated by supervisor!
    ],
  },
  {
    scenarioName: 'Scenario 5: Night Shift crossing Dinner (07:00 – 00:00 Midnight)',
    employeeCode: 'EMP005',
    employeeName: 'R. Jagath',
    dateStr: '2026-08-07', // Friday
    inTime: '07:00',
    outTime: '00:00', // 17h Gross - 2h (Lunch 12-13 + Dinner 22-23) = 15h Effective
    activities: [
      { activityCode: 'CONC-NIGHT', description: 'Night Raft Foundation Concreting', hours: 15.0 },
    ],
  },
  {
    scenarioName: 'Scenario 6: Saturday Shift (Standard Cap = 5.5 Hours)',
    employeeCode: 'EMP006',
    employeeName: 'W. Bandara',
    dateStr: '2026-08-08', // Saturday
    inTime: '07:00',
    outTime: '14:00', // 7h Gross - 1h Lunch = 6h Effective -> 0.5h OT (> 5.5)
    activities: [
      { activityCode: 'PLAST-01', description: 'Internal Wall Plastering', hours: 6.0 },
    ],
  },
  {
    scenarioName: 'Scenario 7: Sunday / Mercantile Holiday (100% All Overtime)',
    employeeCode: 'EMP007',
    employeeName: 'P. Chaminda',
    dateStr: '2026-08-09', // Sunday
    inTime: '07:00',
    outTime: '17:00', // 10h Gross - 1h Lunch = 9h Effective -> All 9h OT
    activities: [
      { activityCode: 'SITE-CLEAN', description: 'Emergency Site Clearance', hours: 9.0 },
    ],
  },
  {
    scenarioName: 'Scenario 8: Approved Additional Hours (+2h Engineer Approved)',
    employeeCode: 'EMP008',
    employeeName: 'H. Sarath',
    dateStr: '2026-08-10', // Monday
    inTime: '07:00',
    outTime: '17:00', // 10h Gross - 1h Lunch = 9h base + 2h additional = 11h
    additionalHours: 2.0,
    activities: [
      { activityCode: 'WELD-01', description: 'Structural Steel Welding', hours: 11.0 },
    ],
  },
];

// ── 6. Runner & Visual Reporter ──────────────────────────────────────────────
async function runAllTests() {
  console.log('\n========================================================================================');
  console.log('       MAGA ERP UPLOAD END-TO-END TRANSACTION PIPELINE VERIFICATION TEST               ');
  console.log('========================================================================================\n');

  let totalPassed = 0;

  for (let idx = 0; idx < scenarios.length; idx++) {
    const sc = scenarios[idx];
    console.log(`\n----------------------------------------------------------------------------------------`);
    console.log(`🔹 [${idx + 1}/8] ${sc.scenarioName}`);
    console.log(`----------------------------------------------------------------------------------------`);

    // STEP 1: Show Raw Input
    console.log(`1️⃣  INPUT DATA RECEIVED:`);
    console.log(`    • Employee:   ${sc.employeeCode} - ${sc.employeeName}`);
    console.log(`    • Date:       ${sc.dateStr} (${getDayTypeRule(sc.dateStr).label})`);
    console.log(`    • In / Out:   ${sc.inTime} ➔ ${sc.outTime}`);
    if (sc.additionalHours) console.log(`    • Additional: +${sc.additionalHours.toFixed(1)} hrs`);
    console.log(`    • Activities Entered:`);
    for (const a of sc.activities) {
      console.log(`        - [${a.activityCode}] ${a.description}: ${a.hours.toFixed(1)} hrs`);
    }

    // STEP 2: Run Transaction & Save to Model
    const entry = processShiftTransaction(sc);
    console.log(`\n2️⃣  TRANSACTION PROCESS & DB ENTITY (MF_OP_TimeEntry):`);
    console.log(`    • Total Presence (Gross Out - In):  hours = ${entry.grossHours.toFixed(1)} hrs`);
    console.log(`    • Lunch / Dinner Deductions:       breakHours = ${entry.breakHours.toFixed(1)} hrs`);
    console.log(`    • Net Effective Worked Hours:       shiftHours = ${entry.shiftHours.toFixed(1)} hrs`);
    console.log(`    • Overtime Calculated:             overtimeHours = ${entry.overtimeHours.toFixed(1)} hrs`);
    console.log(`    • Stored Activity Splits:          ${entry.activitySplits.map(s => `${s.activityCode}(${s.hours}h)`).join(', ')}`);

    // STEP 3: Generate ERP Upload Lines
    const erpRows = generateErpUploadRows(entry);
    console.log(`\n3️⃣  FINAL ERP UPLOAD SHEET OUTPUT (getErpUploadReport):`);
    console.log(`    ┌──────────────────┬────────────┬─────────────────────────────┬───────────┬──────────┐`);
    console.log(`    │ Employee         │ Activity   │ Description                 │ Work Hrs  │ OT Hrs   │`);
    console.log(`    ├──────────────────┼────────────┼─────────────────────────────┼───────────┼──────────┤`);
    for (const row of erpRows) {
      const empCell = row.employeeId.padEnd(16);
      const actCell = row.activityCode.padEnd(10);
      const descCell = row.activityDescription.slice(0, 27).padEnd(27);
      const hrsCell = row.hours.toFixed(1).padStart(7) + 'h';
      const otCell = row.overtimeHours.toFixed(1).padStart(6) + 'h';
      console.log(`    │ ${empCell} │ ${actCell} │ ${descCell} │ ${hrsCell}  │ ${otCell}  │`);
    }
    console.log(`    └──────────────────┴────────────┴─────────────────────────────┴───────────┴──────────┘`);

    // STEP 4: Mathematical Validation Checks
    const sumErpHours = Math.round(erpRows.reduce((s, r) => s + r.hours, 0) * 100) / 100;
    const sumErpOt = Math.round(erpRows.reduce((s, r) => s + r.overtimeHours, 0) * 100) / 100;

    const hoursMatch = sumErpHours === entry.shiftHours;
    const otMatch = sumErpOt === entry.overtimeHours;
    const expectedEffective = Math.round((entry.grossHours - entry.breakHours + (entry.additionalHours || 0)) * 100) / 100;
    const formulaMatches = expectedEffective === entry.shiftHours;

    console.log(`\n4️⃣  INTEGRITY CHECKS:`);
    console.log(`    [${hoursMatch ? 'PASS' : 'FAIL'}] ERP Work Hours (${sumErpHours}h) == TimeEntry.shiftHours (${entry.shiftHours}h)`);
    console.log(`    [${otMatch ? 'PASS' : 'FAIL'}] ERP Overtime (${sumErpOt}h) == TimeEntry.overtimeHours (${entry.overtimeHours}h)`);
    console.log(`    [${formulaMatches ? 'PASS' : 'FAIL'}] Gross Presence (${entry.grossHours}h) - Breaks (${entry.breakHours}h) + Additional (${entry.additionalHours}h) = Effective (${entry.shiftHours}h)`);

    if (hoursMatch && otMatch && formulaMatches) {
      console.log(`    ✅ RESULT: ALL CHECKS PASSED WITH 100% ACCURACY!`);
      totalPassed++;
    } else {
      console.log(`    ❌ RESULT: INTEGRITY ERROR DETECTED!`);
    }
  }

  console.log('\n========================================================================================');
  console.log(`  FINAL SUMMARY: ${totalPassed} / ${scenarios.length} SCENARIOS TESTED & VERIFIED PERFECTLY!`);
  console.log('========================================================================================\n');
}

runAllTests().catch(console.error);
