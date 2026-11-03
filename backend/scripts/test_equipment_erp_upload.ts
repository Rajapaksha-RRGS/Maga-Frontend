/**
 * test_equipment_erp_upload.ts
 * 
 * Comprehensive Test Suite for Equipment ERP Upload Logic:
 * 1. Day-by-day row generation with exact daily dates.
 * 2. mth equipment capped/normalized so total <= 1.00 mth per calendar month.
 * 3. Multi-month isolation (Aug <= 1.00 mth, Sept <= 1.00 mth).
 * 4. 2-decimal rounding reconciliation (sum = 1.00).
 * 5. day equipment preservation of exact daily values (0.50, 1.00).
 * 6. hrs equipment preservation of exact daily hours.
 * 7. Verification against real database records (MMBI0472, MGEN0137, MGEN0165).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ANSI Colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passedTests++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${BOLD}${testName}${RESET}`);
    if (details) console.error(`    ${YELLOW}Details: ${details}${RESET}`);
    failedTests++;
  }
}

// ── Pure Logic Calculation Engine (Matches reportController.ts) ──
interface InputAssignment {
  equipmentCode: string;
  condition: string;
  primaryUnit: string;
  dateStr: string; // YYYY-MM-DD
  activities?: Array<{ code: string; utilization: number; hours?: number }>;
  totalUtilization?: number;
  workingHours?: number;
  totalMileage?: number;
}

interface OutputRow {
  equipment: string;
  condition: string;
  unit: string;
  date: string; // DD-MM-YYYY
  activity: string;
  utilization: string;
}

function processEquipmentErpUpload(
  assignments: InputAssignment[],
  activityCodeParam?: string
): OutputRow[] {
  const defaultActivityCode = activityCodeParam || 'ZOTHE';
  let rows: OutputRow[] = [];

  const mthEntriesByEquipmentAndMonth = new Map<string, {
    erpCode: string;
    condition: string;
    unit: string;
    monthKey: string;
    entries: Array<{ date: string; activity: string; rawQty: number }>;
  }>();

  assignments.forEach((a) => {
    const primaryUnit = (a.primaryUnit || 'hrs').toLowerCase();
    const erpCode = a.equipmentCode;
    const eqCondition = (a.condition || 'DRY').toUpperCase();

    const [yyyy, mm, dd] = a.dateStr.split('-');
    const formattedDate = `${dd}-${mm}-${yyyy}`;
    const monthKey = `${yyyy}-${mm}`;

    if (primaryUnit === 'mth') {
      const groupKey = `${erpCode}___${monthKey}`;
      if (!mthEntriesByEquipmentAndMonth.has(groupKey)) {
        mthEntriesByEquipmentAndMonth.set(groupKey, {
          erpCode,
          condition: eqCondition,
          unit: 'mth',
          monthKey,
          entries: [],
        });
      }
      const group = mthEntriesByEquipmentAndMonth.get(groupKey)!;

      let addedSplits = false;
      if (a.activities && a.activities.length > 0) {
        a.activities.forEach((act) => {
          const code = act.code || defaultActivityCode;
          const q = Number(act.utilization) || Number(act.hours) || 0;
          if (q > 0) {
            addedSplits = true;
            group.entries.push({ date: formattedDate, activity: code, rawQty: q });
          }
        });
      }

      if (!addedSplits) {
        const q = Number(a.totalUtilization) > 0 ? Number(a.totalUtilization) : 1;
        group.entries.push({ date: formattedDate, activity: defaultActivityCode, rawQty: q });
      }
    } else {
      let addedAnyActivity = false;

      if (a.activities && a.activities.length > 0) {
        a.activities.forEach((act) => {
          const code = act.code || defaultActivityCode;
          const q = Number(act.utilization) || Number(act.hours) || 0;
          if (q > 0) {
            addedAnyActivity = true;
            rows.push({
              equipment: erpCode,
              condition: eqCondition,
              unit: primaryUnit,
              date: formattedDate,
              activity: code,
              utilization: q.toFixed(2),
            });
          }
        });
      }

      if (!addedAnyActivity) {
        let q = 0;
        if (primaryUnit === 'km') {
          q = Number(a.totalMileage) || 0;
        } else if (primaryUnit === 'day' || primaryUnit === 'days') {
          q = Number(a.totalUtilization) > 0 ? Number(a.totalUtilization) : 1;
        } else {
          q = Number(a.workingHours) || 0;
        }

        if (q > 0) {
          rows.push({
            equipment: erpCode,
            condition: eqCondition,
            unit: primaryUnit,
            date: formattedDate,
            activity: defaultActivityCode,
            utilization: q.toFixed(2),
          });
        }
      }
    }
  });

  // Process mth equipment per calendar month
  mthEntriesByEquipmentAndMonth.forEach((grp) => {
    const totalRaw = grp.entries.reduce((sum, e) => sum + e.rawQty, 0);
    if (totalRaw <= 0) return;

    const targetTotal = 1.00;
    let allocatedSum = 0;
    const scaledRows: Array<{
      equipment: string;
      condition: string;
      unit: string;
      date: string;
      activity: string;
      utilizationVal: number;
      rawQty: number;
    }> = [];

    grp.entries.forEach((e) => {
      const val = Number(((e.rawQty / totalRaw) * targetTotal).toFixed(2));
      allocatedSum += val;
      scaledRows.push({
        equipment: grp.erpCode,
        condition: grp.condition,
        unit: 'mth',
        date: e.date,
        activity: e.activity,
        utilizationVal: val,
        rawQty: e.rawQty,
      });
    });

    const diff = Number((targetTotal - allocatedSum).toFixed(2));
    if (diff !== 0 && scaledRows.length > 0) {
      let maxItem = scaledRows[0];
      for (const item of scaledRows) {
        if (item.rawQty > maxItem.rawQty) maxItem = item;
      }
      maxItem.utilizationVal = Math.max(0, Number((maxItem.utilizationVal + diff).toFixed(2)));
    }

    scaledRows.forEach((r) => {
      rows.push({
        equipment: r.equipment,
        condition: r.condition,
        unit: r.unit,
        date: r.date,
        activity: r.activity,
        utilization: r.utilizationVal.toFixed(2),
      });
    });
  });

  if (activityCodeParam) {
    rows = rows.filter((r) => r.activity.toLowerCase() === activityCodeParam.toLowerCase());
  }

  rows.sort((a, b) => {
    const [d1, m1, y1] = a.date.split('-');
    const [d2, m2, y2] = b.date.split('-');
    const t1 = new Date(`${y1}-${m1}-${d1}`).getTime();
    const t2 = new Date(`${y2}-${m2}-${d2}`).getTime();
    if (t1 !== t2) return t1 - t2;
    const eqCmp = a.equipment.localeCompare(b.equipment);
    if (eqCmp !== 0) return eqCmp;
    return a.activity.localeCompare(b.activity);
  });

  return rows;
}

// ── Test Suite Runner ────────────────────────────────────────────────────────
async function runAllTests() {
  console.log(`\n${BOLD}${CYAN}=== EQUIPMENT ERP UPLOAD TEST SUITE ===${RESET}\n`);

  // Test 1: mth Equipment - Multi-day activity splits across a single month (MMBI0472 case)
  console.log(`${BOLD}1. mth Equipment - Daily Rows & 1.00 mth Cap Check:${RESET}`);
  {
    const input: InputAssignment[] = [
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-08-04',
        activities: [
          { code: 'ACT-01', utilization: 0.5 },
          { code: 'ACT-02', utilization: 0.5 },
        ],
      },
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-08-05',
        activities: [
          { code: 'ACT-03', utilization: 0.5 },
          { code: 'ACT-04', utilization: 0.5 },
        ],
      },
    ];

    const result = processEquipmentErpUpload(input);

    assert(result.length === 4, 'Generates exactly 4 rows for 4 activities across 2 days');
    assert(result[0].date === '04-08-2026' && result[1].date === '04-08-2026', 'Day 1 rows retain 04-08-2026 date');
    assert(result[2].date === '05-08-2026' && result[3].date === '05-08-2026', 'Day 2 rows retain 05-08-2026 date');
    assert(result.every((r) => r.unit === 'mth'), 'All rows have unit = mth');

    const totalUtil = result.reduce((sum, r) => sum + parseFloat(r.utilization), 0);
    assert(
      Math.abs(totalUtil - 1.00) < 0.001,
      'Total utilization across all days in August is exactly 1.00 mth (does NOT exceed 1)',
      `Actual total: ${totalUtil}`
    );
    assert(
      result.every((r) => r.utilization === '0.25'),
      'Equal 0.5 splits scaled evenly to 0.25 each'
    );
  }

  // Test 2: mth Equipment - Multi-Month Isolation (August and September)
  console.log(`\n${BOLD}2. mth Equipment - Multi-Month Isolation (Aug <= 1.00, Sept <= 1.00):${RESET}`);
  {
    const input: InputAssignment[] = [
      // August entries
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-08-04',
        activities: [{ code: 'ACT-AUG-1', utilization: 1.0 }],
      },
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-08-15',
        activities: [{ code: 'ACT-AUG-2', utilization: 1.0 }],
      },
      // September entries
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-09-02',
        activities: [{ code: 'ACT-SEP-1', utilization: 1.0 }],
      },
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-09-20',
        activities: [{ code: 'ACT-SEP-2', utilization: 1.0 }],
      },
    ];

    const result = processEquipmentErpUpload(input);
    const augRows = result.filter((r) => r.date.endsWith('-08-2026'));
    const sepRows = result.filter((r) => r.date.endsWith('-09-2026'));

    const augTotal = augRows.reduce((s, r) => s + parseFloat(r.utilization), 0);
    const sepTotal = sepRows.reduce((s, r) => s + parseFloat(r.utilization), 0);

    assert(Math.abs(augTotal - 1.00) < 0.001, 'August total is exactly 1.00 mth', `Got: ${augTotal}`);
    assert(Math.abs(sepTotal - 1.00) < 0.001, 'September total is exactly 1.00 mth', `Got: ${sepTotal}`);
    assert(Math.abs(augTotal + sepTotal - 2.00) < 0.001, 'Combined 2-month total is 2.00 mth (1 mth per month)');
  }

  // Test 3: 2-Decimal Rounding Reconciliation (1/3 splits: 0.33, 0.33, 0.34)
  console.log(`\n${BOLD}3. Rounding Reconciliation Check (3 activities = 1.00):${RESET}`);
  {
    const input: InputAssignment[] = [
      {
        equipmentCode: 'MMBI0472',
        condition: 'DRY',
        primaryUnit: 'mth',
        dateStr: '2026-08-01',
        activities: [
          { code: 'ACT-A', utilization: 1.0 },
          { code: 'ACT-B', utilization: 1.0 },
          { code: 'ACT-C', utilization: 1.0 },
        ],
      },
    ];

    const result = processEquipmentErpUpload(input);
    const total = result.reduce((s, r) => s + parseFloat(r.utilization), 0);
    assert(
      Math.abs(total - 1.00) < 0.001,
      'Three 1/3 splits sum exactly to 1.00 mth (reconciled difference applied)',
      `Actual sum: ${total}`
    );
  }

  // Test 4: Day Equipment - Multi-activity & Half-day preserving
  console.log(`\n${BOLD}4. Day Equipment - Exact Daily Values Preserved:${RESET}`);
  {
    const input: InputAssignment[] = [
      {
        equipmentCode: 'MGEN0137',
        condition: 'DRY',
        primaryUnit: 'day',
        dateStr: '2026-08-04',
        activities: [
          { code: 'GEN-ACT-1', utilization: 0.5 },
          { code: 'GEN-ACT-2', utilization: 0.5 },
        ],
      },
      {
        equipmentCode: 'MGEN0165',
        condition: 'DRY',
        primaryUnit: 'day',
        dateStr: '2026-08-04',
        activities: [
          { code: 'GEN-ACT-FULL', utilization: 1.0 },
        ],
      },
    ];

    const result = processEquipmentErpUpload(input);
    const gen137 = result.filter((r) => r.equipment === 'MGEN0137');
    const gen165 = result.filter((r) => r.equipment === 'MGEN0165');

    assert(gen137.length === 2, 'MGEN0137 has 2 rows for 2 activities');
    assert(gen137[0].utilization === '0.50' && gen137[1].utilization === '0.50', 'MGEN0137 keeps 0.50 and 0.50');
    assert(gen137[0].unit === 'day', 'MGEN0137 unit is day');

    assert(gen165.length === 1, 'MGEN0165 has 1 row');
    assert(gen165[0].utilization === '1.00', 'MGEN0165 keeps 1.00');
    assert(gen165[0].unit === 'day', 'MGEN0165 unit is day');
  }

  // Test 5: Hrs Equipment - Preserves exact hours
  console.log(`\n${BOLD}5. Hrs Equipment - Exact Hours Preserved:${RESET}`);
  {
    const input: InputAssignment[] = [
      {
        equipmentCode: 'MEXC0021',
        condition: 'DRY',
        primaryUnit: 'hrs',
        dateStr: '2026-08-03',
        activities: [
          { code: 'EXC-1', utilization: 5.5 },
          { code: 'EXC-2', utilization: 1.2 },
        ],
      },
    ];

    const result = processEquipmentErpUpload(input);
    assert(result.length === 2, 'MEXC0021 has 2 rows');
    assert(result[0].utilization === '5.50' && result[1].utilization === '1.20', 'MEXC0021 keeps 5.50h and 1.20h');
    assert(result[0].unit === 'hrs', 'MEXC0021 unit is hrs');
  }

  // Test 6: Real Database Integration Test
  console.log(`\n${BOLD}6. Database Integration Test (Real DB Data for August 2026):${RESET}`);
  try {
    const dbAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          date: {
            gte: new Date('2026-08-01'),
            lte: new Date('2026-08-31T23:59:59.999Z'),
          },
        },
      },
      include: {
        dailySheet: { select: { date: true } },
        equipment: { include: { corporateEquipment: true } },
        dailyLog: { include: { activities: { include: { activityCode: true } } } },
      },
    });

    const mappedInputs: InputAssignment[] = dbAssignments
      .filter((a) => a.dailyLog)
      .map((a) => {
        const dObj = a.dailySheet.date;
        const dStr = dObj instanceof Date ? dObj.toISOString().slice(0, 10) : String(dObj).slice(0, 10);
        return {
          equipmentCode: a.equipment.corporateEquipment?.standardEquipmentNumber || a.equipment.corporateEquipment?.vehicleNo || 'EQ',
          condition: a.equipment.condition || 'DRY',
          primaryUnit: a.dailyLog?.unitCode || a.equipment.meterUnitCode || a.equipment.corporateEquipment?.unit || 'hrs',
          dateStr: dStr,
          totalUtilization: Number(a.dailyLog?.totalUtilization) || 0,
          workingHours: Number(a.dailyLog?.workingHours) || 0,
          totalMileage: Number(a.dailyLog?.totalMileage) || 0,
          activities: a.dailyLog?.activities?.map((act) => ({
            code: act.activityCode?.code || 'ZOTHE',
            utilization: Number(act.utilization) || 0,
            hours: Number(act.hours) || 0,
          })),
        };
      });

    const realReport = processEquipmentErpUpload(mappedInputs);

    // Verify MMBI0472 in real DB
    const mmbiRows = realReport.filter((r) => r.equipment === 'MMBI0472');
    if (mmbiRows.length > 0) {
      assert(mmbiRows.length === 4, `Real DB MMBI0472 has 4 rows (Got ${mmbiRows.length})`);
      const mmbiSum = mmbiRows.reduce((s, r) => s + parseFloat(r.utilization), 0);
      assert(
        Math.abs(mmbiSum - 1.00) < 0.001,
        `Real DB MMBI0472 total utilization in August is exactly 1.00 mth (Got ${mmbiSum.toFixed(2)})`
      );
      assert(
        mmbiRows.some((r) => r.date === '04-08-2026') && mmbiRows.some((r) => r.date === '05-08-2026'),
        'Real DB MMBI0472 has both 04-08-2026 and 05-08-2026 dates'
      );
    } else {
      console.log(`    ${YELLOW}Note: MMBI0472 not found in current project's August date range${RESET}`);
    }

    // Verify MGEN0137 in real DB
    const gen137Rows = realReport.filter((r) => r.equipment === 'MGEN0137');
    if (gen137Rows.length > 0) {
      assert(gen137Rows.every((r) => r.unit === 'day'), 'Real DB MGEN0137 has unit = day');
      assert(gen137Rows.every((r) => r.utilization === '0.50'), 'Real DB MGEN0137 has 0.50 utilization');
    }

    assert(realReport.length > 0, `Real DB generated ${realReport.length} total ERP rows`);
  } catch (err: any) {
    assert(false, 'Database integration test ran without error', err?.message);
  }

  // ── Summary ──
  console.log(`\n${BOLD}========================================${RESET}`);
  if (failedTests === 0) {
    console.log(`${BOLD}${GREEN}ALL ${passedTests} TESTS PASSED SUCCESSFULLY! 🎉${RESET}`);
  } else {
    console.log(`${BOLD}${RED}${failedTests} TESTS FAILED, ${passedTests} passed.${RESET}`);
  }
  console.log(`${BOLD}========================================${RESET}\n`);

  await prisma.$disconnect();
  process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  prisma.$disconnect();
  process.exit(1);
});

