# 🏗️ Maga Equipment & Operator Pool System — Implementation Blueprint

**Document Version:** 1.0  
**Status:** Approved Architecture Plan (Ready for Implementation)  
**Target Systems:** Supervisor Mobile App, Admin Dashboard, Backend API & Database, ERP Upload Reports (Maga SAP/IFS)

---

## 📌 1. Executive Summary & Problem Context

### 1.1 The Core Problem
Previously, equipment (plant and machinery) was statically assigned by Admin to a single supervisor for each date (`MF_OP_DailyEquipmentAssignment`). On an active construction site, this caused major friction:
* Heavy machinery (excavators, tippers, backhoes, bowsers) is routinely shared between **2 or 3 supervisors** across the day (e.g. Earthworks supervisor in morning, Drainage/Structure supervisor in afternoon).
* Static supervisor assignment locked the machine, preventing other supervisors from recording valid utilization.
* Day-rated vehicles (`Days` / `mth`) created an accounting mismatch with human machine operators who work in **Hours** with overtime rules.

### 1.2 The Final Solution Principle
1. **Site Equipment Pool:** Equipment is not locked to one supervisor. All active project equipment is pooled at the site level. Any supervisor can pick any machine from the pool and record actual work done under their supervision.
2. **Attendance-Filtered Operator Selection:** Only machine operators who have marked their daily attendance (**In-Time**) appear in the supervisor's operator dropdown when logging machine work.
3. **Actual Hours Input with Automatic Day Ratio (Pro-rata Engine):**
   * Supervisors log **Actual Hours** worked on each activity (e.g. 4.0h on Activity A, 2.0h on Activity B).
   * For Day-rated equipment (`Days` / `mth`), the system automatically divides by total worked hours to calculate the exact **Day Ratio** (e.g. `0.67 Day` and `0.33 Day` = `1.00 Day`) for commercial ERP billing.
   * For the Operator, the actual worked hours are credited directly to the activities, any unallocated shift balance is reconciled as **`ZIDLE`**, and overtime is exported as a separate **`ZOTHE`** line.
4. **Multi-Supervisor Aggregation & Conflict Detection:**
   * If two supervisors use the same vehicle (e.g. Sup 1: 6h + 4h, Sup 2: 6h + 4h = total 20h):
     * Equipment ERP upload aggregates all activities under **Single Day Pro-rata** (e.g. 0.30, 0.20, 0.30, 0.20 Day = 1.00 Day) or **Double Shift** (2.00 Days) based on site contract.
     * Both operators receive their respective shift hours & OT cleanly.
     * Admin Dashboard displays a **Consolidated Site Equipment View** to instantly detect day/night shifts or daytime duplicate conflicts.

---

## 📐 2. Core Mathematical & Business Logic (The Ratio Engine)

```
[ Supervisor Inputs Actual Hours ]
  Activity 1: 4.0 Hours
  Activity 2: 2.0 Hours
  (Total Machine Worked = 6.0 Hours)
               │
               ▼
┌────────────────────────────────────────────────────────┐
│               BACKEND RATIO ENGINE                     │
│                                                        │
│  Total Worked = 4.0 + 2.0 = 6.0 Hours                  │
│  Ratio(Activity 1) = 4.0 / 6.0 = 0.6667 (66.7%)        │
│  Ratio(Activity 2) = 2.0 / 6.0 = 0.3333 (33.3%)        │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  EQUIPMENT ERP UPLOAD        │  │  OPERATOR LABOR ERP UPLOAD   │
│  Unit = 'Days' (1.00 Day)    │  │  Operator Shift = 8.0 Hours  │
│                              │  │                              │
│  • Act 1: 0.67 Day (67%)     │  │  • Act 1: 4.00 Hours         │
│  • Act 2: 0.33 Day (33%)     │  │  • Act 2: 2.00 Hours         │
│  ─────────────────────────   │  │  • ZIDLE: 2.00 Hours (Idle)  │
│  Total:   1.00 Day           │  │  ─────────────────────────   │
│                              │  │  Total:   8.00 Hours         │
└──────────────────────────────┘  └──────────────────────────────┘
```

### 2.1 Day-Rated Equipment Ratio Formula
For any day-rated equipment with logged activity hours $H_1, H_2, \dots, H_n$:
$$\text{Total Machine Worked Hours } (H_{\text{total}}) = \sum_{i=1}^n H_i$$
$$\text{Activity Ratio}_i = \frac{H_i}{H_{\text{total}}}$$
$$\text{Equipment ERP Utilization}_i = \text{Activity Ratio}_i \times \text{Contract Day Factor (e.g. 1.00 Day)}$$

### 2.2 Operator Labor Allocation Formula
* **Effective Physical Shift ($S_{\text{eff}}$):** $\text{Out Time} - \text{In Time} - \text{Lunch Break (1.0h)}$.
* **Standard Regular Cap ($S_{\text{cap}}$):** 8.00 Hours (on normal calendar days).
* **Allocated Activity Hours:** Direct worked hours $H_i$.
* **Idle Balance ($\text{ZIDLE}$):** 
  $$\text{ZIDLE Hours} = \max\left(0, S_{\text{eff}} - \sum H_i\right)$$
* **Overtime ($\text{ZOTHE}$):** 
  $$\text{OT Hours} = \max\left(0, S_{\text{eff}} - S_{\text{cap}}\right)$$

### 2.3 Double Supervisor Example (20.0 Hours Total)
* **Supervisor 1:** Activity 1 = 6h, Activity 2 = 4h (10h total, Operator Kamal).
* **Supervisor 2:** Activity 3 = 6h, Activity 4 = 4h (10h total, Operator Nimal).
* **Single Day Pro-rata Equipment ERP (1.00 Day Total):**
  * Activity 1: $(6 / 20) \times 1.0 = \mathbf{0.30\text{ Day}}$
  * Activity 2: $(4 / 20) \times 1.0 = \mathbf{0.20\text{ Day}}$
  * Activity 3: $(6 / 20) \times 1.0 = \mathbf{0.30\text{ Day}}$
  * Activity 4: $(4 / 20) \times 1.0 = \mathbf{0.20\text{ Day}}$
  * **Sum:** $0.30 + 0.20 + 0.30 + 0.20 = \mathbf{1.00\text{ Day}}$.
* **Labor Allocation:**
  * Operator Kamal (10h shift): Act 1 = 6.0h, Act 2 = 4.0h, OT = 2.0h line.
  * Operator Nimal (10h shift): Act 3 = 6.0h, Act 4 = 4.0h, OT = 2.0h line.

---

## 🗄️ 3. Database Schema & Migration Plan

The existing PostgreSQL schema (`schema.prisma`) already supports 90% of this architecture. **No breaking changes or table rebuilds are required.**

### 3.1 Table Modifications

#### A. Table: `MF_OP_EquipmentDailyLogActivity`
Add one optional column to retain supervisor's raw input hours alongside the calculated Day utilization:
```prisma
model MF_OP_EquipmentDailyLogActivity {
  id             String   @id @default(uuid()) @map("daily_log_activity_id")
  dailyLogId     String   @map("daily_log_id")
  activityCodeId String   @map("activity_code_id")
  hours          Decimal? @default(0.00) @map("hours") @db.Decimal(6, 2)       // ⭐ NEW: Actual worked hours (e.g. 4.00, 2.00)
  utilization    Decimal  @default(0.00) @map("utilization") @db.Decimal(8, 2) // Calculated ERP value (e.g. 0.67 Day)
  remarks        String?
  createdAt      DateTime @default(now()) @map("created_at")

  dailyLog     MF_OP_EquipmentDailyLog @relation(fields: [dailyLogId], references: [id], onDelete: Cascade)
  activityCode MF_P_ActivityCode       @relation(fields: [activityCodeId], references: [id])

  @@index([dailyLogId])
  @@index([activityCodeId])
  @@map("MF_L_EQUIPMENT_DAILY_LOG_ACTIVITY")
}
```

#### B. Table: `MF_OP_DailyEquipmentAssignment`
* **Zero Schema Changes.**
* Existing constraint: `@@unique([dailySheetId, equipmentId])`.
* Because `dailySheetId` is unique per `(projectId, supervisorId, date)`, Supervisor A and Supervisor B can both have their own assignment record for the same equipment on the same date without conflicts.

#### C. Table: `MF_OP_TimeEntry`
* **Zero Schema Changes.**
* Already contains `employeeId`, `equipmentId`, `activityId`, `hours`, `overtimeHours`, `inTime`, and `outTime`.

---

## 📱 4. UI / UX Changes Breakdown

### 4.1 Supervisor Mobile App (`EquipmentLogsView.tsx`)
1. **Remove Admin Assignment Lock:**
   * Do not restrict supervisor only to equipment pre-assigned by Admin.
2. **"+ Add Equipment from Site Pool" Button:**
   * Tapping opens a bottom-sheet modal listing all active equipment in the project site.
   * Searchable by Vehicle No, Maga Code, or Name (e.g. `EX-01`, `WP LA-4521`).
3. **Smart Pre-Fill (Latest Meter / Status):**
   * When an equipment is selected, the system fetches its latest final meter reading from the previous shift/day and pre-fills `Start Meter`.
4. **Attendance-Filtered Operator Dropdown:**
   * When picking an operator, only operators with `inTime != null` on the selected date are selectable.
   * If an operator hasn't checked in yet, a helper badge states: `⚠️ In-Time not recorded yet`.
5. **Activity Split Entry (Actual Hours):**
   * Supervisors add activity rows and enter **Actual Hours** (e.g. 4.0h, 2.0h) instead of mental decimals.
   * Live preview displays:
     * `Total Machine Run: 6.0 Hours`
     * `ERP Day Equivalent: 0.67 Day + 0.33 Day = 1.00 Day`

### 4.2 Supervisor Mobile App (`OperatorEntryView.tsx`)
1. **Attendance Marking (In / Out Time):**
   * Supervisor or Admin marks In-Time (`07:30`) and Out-Time (`17:00`).
   * Displays effective hours and auto-calculated OT.
2. **Auto-Populated Machine Work Summary:**
   * Operator card displays the machines and activities they operated based on equipment logs submitted for them, showing regular hours + `ZIDLE` balance.

### 4.3 Admin Dashboard (`AssignmentsHubPage.tsx`)
1. **Equipment Tab Transformation:**
   * Instead of assigning equipment to supervisors, the tab becomes **Site Equipment Roster & Status Monitor**:
     * Status badges: `Active in Site Pool`, `Under Maintenance`, `Standby`.
     * Current Day Summary: Machines currently being used vs idle in yard.
2. **Operator Tab:**
   * Site Operator attendance hub (marking or reviewing In/Out times for site operators).

### 4.4 Admin Approvals Page (`ApprovalsPage.tsx` & `SupervisorApprovalCard.tsx`)
1. **Supervisor Approval Card:**
   * Displays equipment logs submitted by that supervisor with actual hours and calculated Day ratios.
2. **Consolidated Daily Equipment Summary (New View):**
   * A unified table showing every equipment on site and all supervisors who logged time on it today.
   * Example row:
     ```
     EX-01 | Excavator | Total: 20.0h | Sup 1 (10h, কামাল) + Sup 2 (10h, නිමල්) | ERP: 1.00 Day Pro-rata
     ```
3. **Overlap & Conflict Warning Alert:**
   * If two supervisors log overlapping daytime meter readings or hours exceed physical daytime limits without a night shift flag:
     `⚠️ Potential Overlap: M020 has 20.0 hours logged across 2 supervisors. Verify Day/Night shift.`

---

## 🔌 5. Backend API & Engine Architecture

### 5.1 New & Updated Endpoints

| Endpoint | Method | Purpose |
| :--- | :---: | :--- |
| `/api/equipment/site-pool` | `GET` | Returns all active site equipment with latest meter readings for selected date. |
| `/api/assignments/operators/available` | `GET` | Returns operators who have `inTime` marked for the date (attendance-filtered). |
| `/api/time-entries/equipment-log` | `POST` | Upserts equipment log under supervisor's daily sheet, executes Ratio Engine, and updates operator's `MF_OP_TimeEntry`. |
| `/api/reports/equipment-erp-upload` | `GET` | Generates equipment ERP upload rows using single day pro-rata ratio aggregation. |
| `/api/reports/erp-upload` | `GET` | Generates labor ERP upload rows with direct hours, `ZIDLE` balancing, and calendar OT lines. |
| `/api/equipment/daily-consolidated` | `GET` | Provides Admin with a consolidated cross-supervisor equipment usage summary. |

### 5.2 The Unified Ratio Engine Algorithm (Backend Implementation)
```typescript
function reconcileEquipmentAndOperatorLabor({
  equipmentUnit,        // 'Days' | 'Hrs' | 'mth'
  activitySplits,       // [{ activityCodeId, hours }]
  operatorId,
  operatorShiftEffectiveHours, // e.g. 10.0h
  standardCap = 8.0,
}) {
  const totalWorkedHours = activitySplits.reduce((sum, s) => sum + s.hours, 0);
  if (totalWorkedHours <= 0) return;

  // 1. Calculate ratios
  const splitsWithRatios = activitySplits.map((s) => ({
    ...s,
    ratio: s.hours / totalWorkedHours,
    dayUtilization: (equipmentUnit === 'Days' || equipmentUnit === 'mth')
      ? parseFloat(((s.hours / totalWorkedHours) * 1.0).toFixed(2))
      : s.hours,
  }));

  // 2. Generate Operator Labor Activity Splits
  const operatorActivityEntries = splitsWithRatios.map((s) => ({
    activityCodeId: s.activityCodeId,
    hours: s.hours,
    overtimeHours: 0,
  }));

  // 3. Reconcile ZIDLE (Idle Hours) if operator shift exceeds machine work
  let idleHours = 0;
  if (operatorShiftEffectiveHours > totalWorkedHours) {
    idleHours = parseFloat((operatorShiftEffectiveHours - totalWorkedHours).toFixed(2));
  }

  // 4. Calculate Overtime Line
  let otHours = 0;
  if (operatorShiftEffectiveHours > standardCap) {
    otHours = parseFloat((operatorShiftEffectiveHours - standardCap).toFixed(2));
  }

  return {
    splitsWithRatios,
    totalUtilization: 1.00,
    operatorActivityEntries,
    idleHours,
    otHours,
  };
}
```

---

## 🚀 6. Phased Implementation Roadmap (When Ready)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: DATABASE & BACKEND FOUNDATION                      │
│ • Add `hours` column to `MF_OP_EquipmentDailyLogActivity`   │
│ • Run `prisma db push` / `prisma generate`                  │
│ • Implement Ratio Engine utility in backend                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: BACKEND APIS & ERP EXPORT UPDATE                   │
│ • Implement Site Pool & Available Operators endpoints       │
│ • Update equipment-log saving controller                    │
│ • Update `/api/reports/equipment-erp-upload` (Pro-rata)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: SUPERVISOR MOBILE APP UI                           │
│ • Add "+ Add from Site Pool" modal in `EquipmentLogsView`   │
│ • Add Actual Hours input fields per activity                │
│ • Filter operator dropdown by In-Time attendance            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: ADMIN DASHBOARD & APPROVALS                        │
│ • Transform Assignment Hub Equipment tab to Pool Monitor    │
│ • Add Consolidated Cross-Supervisor Machine table           │
│ • Add Overlap / Over-capacity warning badge                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: VERIFICATION & EXPORT AUDIT                        │
│ • Test with real site scenario (2 supervisors, 4 activities)│
│ • Validate generated Excel/CSV uploads against Maga ERP     │
└─────────────────────────────────────────────────────────────┘
```

---

**End of Implementation Plan.**  
*This document serves as the single source of truth for the upcoming implementation phase.*
