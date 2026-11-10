# DRY & Single Source of Truth Code Review Audit

**Project:** Mäga Construction ERP (Labour & Machinery Attendance Management System)  
**Author:** Senior Backend Reviewer  
**Status:** Audit Complete — Stage 1 (Read-Only Audit)  
**Date:** November 2026  
**Reference Document:** `frontend/dev-system-spec.md`, `Work Hours & Overtime (OT) Calculation Logic.md`, `schema.prisma`

---

## 1. Executive Summary Table

| Rule / Business Logic | Copies Found | Do They Differ? | Severity | Primary Risk |
| :--- | :---: | :---: | :---: | :--- |
| **1. Tenant Isolation & Project Resolution** | 42+ | **YES** | **HIGH** | Cross-tenant data leakage; `resolveProjectId` queries arbitrary tenant data |
| **2. Route Protection & RBAC / Supervisor Ownership** | 15+ | **YES** | **HIGH** | Unauthenticated attendance mutation; supervisor ID spoofing; missing `requireAuth` |
| **3. Submission & Lock Enforcement** | 9 | **YES** | **HIGH** | Approved/submitted entries overwritten via bulk APIs (`assignActivityBulk`, splits) |
| **4. Shift Break & Lunch Deduction** | 5 | **YES** | **HIGH** | 1-hour shift discrepancy (window overlap vs `>= 5h` gross threshold) |
| **5. Overtime Derivation & Half-Day Caps** | 6 | **YES** | **HIGH** | Half-day 4.0h standard ignored in bulk APIs; negative OT applied to external subs |
| **6. Day Type Resolution & Holiday Calendar** | 4 | **YES** | **HIGH** | `reportController` hardcodes weekend check and ignores database holiday calendar |
| **7. Daily Assignment Uniqueness (1 Worker / Day)** | 5 | **YES** | **HIGH** | DB constraint is per-sheet only; `copyGangsFromDate` duplicates workers |
| **8. Rate Divisor, OT Multiplier, & 10% Overhead** | 8 | **YES** | **HIGH** | Magic numbers (8, 1.5, 0.10); holiday 2.0x multiplier ignored in pay/billing |
| **9. ZIDLE Shortage Auto-Balancing** | 4 | **YES** | **HIGH** | Inconsistent thresholds (`>0` vs `>0.05`); double-counting risk in reports vs DB |
| **10. Date & Time Range Parsing / Timezones** | 6 | **YES** | **MEDIUM** | UTC vs local `setHours` boundary shifts; `dateRange` truncates at 31 days |
| **11. Effective Daily Rate Fallback Resolution** | 7 | **YES** | **MEDIUM** | Magic fallbacks (1400 vs 1600); duplicated query chains across modules |
| **12. Field Validation Consistency** | 8 | **YES** | **MEDIUM** | `hours` allowed 0 / negative / NaN; no 24-hour daily maximum ceiling |
| **13. Query Duplication & Employee Filtering** | 6 | **YES** | **MEDIUM** | Copy-pasted ORM query structures with diverging search fields |
| **14. Shared Constants & Raw String Literals** | 50+ | **YES** | **MEDIUM** | Magic strings for statuses, day types, and roles with no enum safety |
| **15. Report Calculation vs Excel Export Parity** | 4 | **NO (Partial)** | **MEDIUM** | Client Excel generator re-sums rows independently; null work hours fallback |
| **16. Database Constraints vs Application Invariants** | 6 | **YES** | **HIGH** | Missing DB constraints for assignments, positive hours, and enum statuses |

---

## 2. Detailed Findings (High Severity First)

---

### Finding 1: Tenant Isolation & Project Resolution Bypassed Across Endpoints
- **Rule Name:** Multi-Tenant Isolation & Project Scope Resolution
- **Locations Found:**
  1. [`backend/src/middleware/tenantMiddleware.ts:13-55`](file:///g:/Maga-Frontend/backend/src/middleware/tenantMiddleware.ts#L13-L55) (`resolveTenantMiddleware`)
  2. [`backend/src/controllers/reportController.ts:10-43`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L10-L43) (`resolveProjectId`)
  3. [`backend/src/utils/tenantHelper.ts:7-29`](file:///g:/Maga-Frontend/backend/src/utils/tenantHelper.ts#L7-L29) (`getDefaultTenantId`)
  4. Boilerplate repeated in 40+ controller action headers, e.g.:
     - [`backend/src/controllers/timeEntryController.ts:463-468`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L463-L468)
     - [`backend/src/controllers/timeEntryController.ts:1054-1059`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1054-L1059)
     - [`backend/src/controllers/timeEntryController.ts:3166-3171`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3166-L3171)
     - [`backend/src/controllers/assignmentController.ts:40-46`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L40-L46)
     - [`backend/src/controllers/assignmentController.ts:187-193`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L187-L193)
     - [`backend/src/controllers/activityCodeController.ts:16-21`](file:///g:/Maga-Frontend/backend/src/controllers/activityCodeController.ts#L16-L21)

- **How the Implementations Differ:**
  - In `tenantMiddleware.ts`: Inspects untrusted client inputs (`x-tenant-id`, `x-project-id`, `req.query.tenantId`, `req.body.tenantId`). It runs in `server.ts:47` *before* `requireAuth`, so `req.user` is never checked.
  - In `reportController.ts`: If no query parameter is provided, it falls back to:
    ```typescript
    // reportController.ts:32-39
    const activeWithEntries = await prisma.mF_P_Project.findFirst({
      where: { status: "active", timeEntries: { some: {} } },
      select: { id: true },
    });
    if (activeWithEntries) return activeWithEntries.id;
    ```
    It loads *whichever random project has records in the database*, completely disregarding the authenticated user's organization!
  - In controllers: Copy-pasted 5-line block checks `req.resolvedProjectId || req.resolvedTenantId || req.query.projectId || req.body.projectId || (await getDefaultTenantId())`.

- **Differing Code Side-by-Side:**
  ```typescript
  // reportController.ts:10-42                      // timeEntryController.ts:1054-1059
  async function resolveProjectId(req) {           const projectId =
    const candidate = req.resolvedProjectId ||       req.resolvedProjectId ||
      req.resolvedTenantId ||                        req.resolvedTenantId ||
      qStr(req.query.projectId);                     req.body.projectId ||
    if (candidate) { ... }                           req.body.tenantId ||
    const activeWithEntries = await prisma...        (await getDefaultTenantId());
    return activeWithEntries.id;
  }
  ```

- **Concrete Bug Risk & Worked Example:**
  - **Scenario:** Tenant A ("Alpha Builders", `projectId: "proj-alpha"`) is logged in. A supervisor or admin sends a request: `GET /api/reports/bp-bill?tenantId=proj-beta` or omitting `tenantId`.
  - **Result:** `resolveTenantMiddleware` blindly accepts `proj-beta` from the query parameter. All contractor billing, employee lists, and hourly wage rates for Tenant B ("Beta Constructions") are returned to Tenant A. If `tenantId` is omitted, `reportController` returns whichever company first entered time entries in the database.
- **Severity:** **HIGH** (Severe multi-tenant security vulnerability and data leakage).
- **Proposed Single Home:** `backend/src/domain/tenant/tenantContext.ts`:
  `function getAuthorizedProjectId(req: Request): string`
  Strictly derives the project/tenant from `req.user.projectId` (verified via JWT) for non-super-admins; only allows query/header overrides if `req.user.role === 'super_admin'`.

---

### Finding 2: Unprotected Mutation Routes & Missing Supervisor Ownership
- **Rule Name:** Route Authentication & Supervisor Record Ownership
- **Locations Found:**
  1. [`backend/src/routes/timeEntryRoutes.ts:26-35, 43-48`](file:///g:/Maga-Frontend/backend/src/routes/timeEntryRoutes.ts#L26-L35)
  2. [`backend/src/routes/assignmentRoutes.ts:22-42`](file:///g:/Maga-Frontend/backend/src/routes/assignmentRoutes.ts#L22-L42)
  3. [`backend/src/routes/reportRoutes.ts:35-46`](file:///g:/Maga-Frontend/backend/src/routes/reportRoutes.ts#L35-L46)
  4. [`backend/src/controllers/timeEntryController.ts:667-684`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L667-L684) (`checkInEmployee`)
  5. [`backend/src/controllers/timeEntryController.ts:3177-3185`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3177-L3185) (`saveBulkLaborTimeEntries`)

- **How the Implementations Differ:**
  - `employeeRoutes.ts` and `activityCodeRoutes.ts` apply `requireAuth` and `requireAdmin` selectively.
  - In `timeEntryRoutes.ts`, **12 critical mutation and read routes are completely unauthenticated**:
    `/check-in`, `/check-out`, `/assign-activity`, `/upsert`, `/labor/bulk`, `/submit`, `/operators`, `/operators/bulk`, `/equipment/bulk`, `/assigned`, `/day-status`, `/`.
  - In `assignmentRoutes.ts`, **all 11 assignment routes are completely unauthenticated**.
  - In `reportRoutes.ts`, **all report generation endpoints are unauthenticated**.
  - In `timeEntryController.ts`, when resolving `supervisorId`, the controller trusts `req.body.supervisorId` or `req.query.supervisorId`:
    ```typescript
    // timeEntryController.ts:3177-3184
    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }
    ```
    It never asserts `req.user.userId === supervisorId` or verifies that `req.user.role === 'admin'`.

- **Concrete Bug Risk & Worked Example:**
  - An anonymous HTTP client can send `POST /api/time-entries/labor/bulk` with `{ date: "2026-11-10", supervisorId: "sup-002", entries: [...] }`.
  - The system creates daily sheets and logs hours under Supervisor `sup-002` without requiring a valid JWT session or verifying that the worker is assigned to that supervisor.
- **Severity:** **HIGH** (Authentication bypass & identity spoofing).
- **Proposed Single Home:** `backend/src/middleware/authMiddleware.ts` + `backend/src/domain/auth/ownershipGuard.ts`:
  `function assertSupervisorOwnership(req: Request, targetSupervisorId: string): void`

---

### Finding 3: Day Submission & Approval Locking Bypassed by Bulk APIs
- **Rule Name:** Shift Immutability After Submission & Approval
- **Locations Found:**
  1. [`backend/src/controllers/timeEntryController.ts:652-664`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L652-L664) (`checkInEmployee`)
  2. [`backend/src/controllers/timeEntryController.ts:776-788`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L776-L788) (`checkOutEmployee`)
  3. [`backend/src/controllers/timeEntryController.ts:837-1045`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L837-L1045) (`assignActivityBulk`)
  4. [`backend/src/controllers/timeEntryController.ts:1050-1190`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1050-L1190) (`upsertTimeEntry`)
  5. [`backend/src/controllers/timeEntryController.ts:2450-2620`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L2450-L2620) (`saveOperatorEntry`)
  6. [`backend/src/controllers/timeEntryController.ts:2621-2965`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L2621-L2965) (`saveBulkOperatorEntries`)
  7. [`backend/src/controllers/timeEntryController.ts:3158-3530`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3158-L3530) (`saveBulkLaborTimeEntries`)
  8. [`backend/src/controllers/assignmentController.ts:307-320`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L307-L320) (`unassignEmployee`)

- **How the Implementations Differ:**
  - `checkInEmployee` and `checkOutEmployee` query `prisma.mF_OP_TimeEntry` for `status: { in: ['submitted', 'approved'] }` and reject with HTTP 403.
  - `assignActivityBulk` and `upsertTimeEntry` **have zero lock checks**; they directly update or delete time entry rows even if the sheet is `submitted` or `approved`.
  - In `saveBulkLaborTimeEntries`, lines 3370-3371 check `if (primary.status !== 'submitted' && primary.status !== 'approved')` to guard `TimeEntry` updates, but lines 3453-3528 unconditionally delete all `LaborActivitySplit` rows and update `TimeEntry.hours`!
  - In `unassignEmployee` (`assignmentController.ts:308-319`), it deletes time entries where `status: { not: 'approved' }` — meaning all `submitted` (locked) daily sheets have their time entries silently purged if an admin unassigns a worker.

- **Differing Code Side-by-Side:**
  ```typescript
  // checkInEmployee (Lines 652-663)               // assignActivityBulk (Lines 930-975)
  const lockedCheck = await prisma                 // NO CHECK! Directly executes:
    .mF_OP_TimeEntry.findFirst({                   await prisma.mF_OP_LaborActivitySplit.upsert(...);
      where: {                                     await prisma.mF_OP_TimeEntry.update({
        projectId, date, employeeId,                 where: { id: primary.id },
        status: { in: ['submitted', 'approved'] }    data: { hours: totalSplitHours }
      }                                            });
    });
  if (lockedCheck) return res.status(403);
  ```

- **Concrete Bug Risk & Worked Example:**
  - Supervisor submits Sheet on 2026-11-01 (`status = 'submitted'`). Project Admin approves it on 2026-11-02 (`status = 'approved'`).
  - On 2026-11-05, Supervisor opens the bulk activity dialog and assigns 4 hours of `GEN-01` to that employee on `2026-11-01` via `POST /api/time-entries/assign-activity`.
  - `assignActivityBulk` bypasses locks and mutates the approved time entry. Approved payroll reports now diverge from the ERP export.
- **Severity:** **HIGH** (Breaks non-repudiation and auditability of payroll).
- **Proposed Single Home:** `backend/src/domain/locks/dayLockService.ts`:
  `async function assertDayNotLocked(projectId: string, date: Date, employeeId?: string, supervisorId?: string): Promise<void>`

---

### Finding 4: Divergent Break & Lunch Deduction Algorithms
- **Rule Name:** Shift Break Duration & Lunch/Dinner Deduction
- **Locations Found:**
  1. [`backend/src/controllers/timeEntryController.ts:83-160`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L83-L160) (`computeBreakHoursAndSnapshots`)
  2. [`backend/src/controllers/timeEntryController.ts:163-170`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L163-L170) (`computeBreakHours`)
  3. [`backend/src/controllers/reportController.ts:114-124`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L114-L124) (`computeAttendanceHoursAndOt`)
  4. [`backend/src/controllers/reportController.ts:969-975`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L969-L975) (`getErpUploadReport`)
  5. [`frontend/src/utils/overtimeCalculator.ts:46-78`](file:///g:/Maga-Frontend/frontend/src/utils/overtimeCalculator.ts#L46-L78) (`calculateBreakHours`)

- **How the Implementations Differ:**
  - `timeEntryController` uses a **Window Overlap Algorithm** against project meal policy settings (`lunchStartTime`, `lunchEndTime`, default 12:00-13:00; `dinnerStartTime`, `dinnerEndTime`, default 22:00-23:00). Overnight shifts are split across midnight (`[inMins, 1440]` + `[0, outMins]`).
  - `reportController.ts:114-124` uses an **Absolute Duration Algorithm**:
    ```typescript
    let breakMins = 0;
    if (diffMins >= 300) breakMins += 60; // 5.0h gross threshold
    const isPast11PM = diffMins >= 720 || ((outMins >= inMins) ? (outMins >= 23 * 60) : (inMins <= 23 * 60 || outMins >= 23 * 60));
    if (isPast11PM) breakMins += 60;
    ```
  - `reportController.ts:969-975` uses a third variant: checks `grossH >= 5.0` and `isPast11PM` using floating-point hours (`23.0`).
  - `frontend/overtimeCalculator.ts` uses hardcoded 12:00-13:00 and 22:00-23:00, ignoring custom project policies (`lunchStartTime`/`lunchDurationHours`).

- **Differing Code Side-by-Side:**
  ```typescript
  // timeEntryController.ts:136-149                 // reportController.ts:114-122
  if (policy.lunchBreakEnabled) {                  let breakMins = 0;
    const overlap = calcWindowOverlap(             if (diffMins >= 300) { // 5 hours
      lunchStart, lunchEnd                           breakMins += 60;
    );                                             }
    if (overlap > 0) {                             if (diffMins >= 720 || isPast11PM) {
      isLunchDeducted = true;                        breakMins += 60;
      totalBreak += policy.lunchDuration;          }
    }
  }
  ```

- **Concrete Bug Risk & Worked Example:**
  - Shift A: 11:30 to 14:30 (3.0 gross hours). Overlaps 12:00-13:00.
    - `timeEntryController`: break = 1.0 hr $\rightarrow$ Effective Hours = **2.0 hrs**.
    - `reportController`: gross = 180 min (< 300 min) $\rightarrow$ break = 0.0 hr $\rightarrow$ Effective Hours = **3.0 hrs**.
  - Shift B: 06:00 to 11:30 (5.5 gross hours, morning shift). Does not overlap 12:00-13:00.
    - `timeEntryController`: overlap = 0 $\rightarrow$ break = 0.0 hr $\rightarrow$ Effective Hours = **5.5 hrs**.
    - `reportController`: gross = 330 min ($\ge$ 300 min) $\rightarrow$ break = 1.0 hr $\rightarrow$ Effective Hours = **4.5 hrs**.
  - Result: The stored time entry says 5.5 hrs, but when the report runs fallback calculations, it displays 4.5 hrs.
- **Severity:** **HIGH** (Directly impacts hours worked and contractor wages).
- **Proposed Single Home:** `backend/src/domain/time/breakCalculator.ts`:
  `function calculateBreakHours(inTime: string, outTime: string, policy?: SiteMealPolicy): { breakHours: number; isLunchDeducted: boolean; isDinnerDeducted: boolean }`

---

### Finding 5: Overtime Derivation, Half-Day Standards, & External Negative OT
- **Rule Name:** Shift Attendance Classification & Overtime Calculation
- **Locations Found:**
  1. [`backend/src/controllers/timeEntryController.ts:172-247`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L172-L247) (`calculateShiftAndOvertime`)
  2. [`backend/src/controllers/timeEntryController.ts:920-928`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L920-L928) (`assignActivityBulk`)
  3. [`backend/src/controllers/timeEntryController.ts:1124-1125`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1124-L1125) (`upsertTimeEntry`)
  4. [`backend/src/controllers/timeEntryController.ts:3304-3317`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3304-L3317) (`saveBulkLaborTimeEntries`)
  5. [`backend/src/controllers/calendarController.ts:116-129`](file:///g:/Maga-Frontend/backend/src/controllers/calendarController.ts#L116-L129) (`recalculateUnapprovedEntriesForDate`)
  6. [`backend/src/controllers/reportController.ts:126-137`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L126-L137) (`computeAttendanceHoursAndOt`)
  7. [`backend/src/controllers/reportController.ts:1037-1049`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L1037-L1049) (`getErpUploadReport`)

- **How the Implementations Differ:**
  - `calculateShiftAndOvertime` correctly distinguishes:
    - Internal Weekday > 6h: Full Day (1.0), base 8.0h $\rightarrow \text{OT} = \text{shiftHours} - 8.0$.
    - Internal Weekday $\le$ 6h: Half Day (0.5), base 4.0h $\rightarrow \text{OT} = \text{shiftHours} - 4.0$.
    - Internal Saturday: Full Day (1.0), base 5.5h $\rightarrow \text{OT} = \text{shiftHours} - 5.5$.
    - External Subcontractor: Days = 0, no negative OT allowed ($\text{OT} = \max(0, \text{shiftHours} - \text{cap})$).
  - In `assignActivityBulk:922` and `upsertTimeEntry:1124`:
    Only checks `newTotalHours > standardHoursCap` (where cap is 8.0 or 5.5). Completely omits the Half-Day 4.0h baseline and never computes negative overtime!
  - In `calendarController:116-129` (`recalculateUnapprovedEntriesForDate`):
    Applies negative OT to *all* entries without checking `isExternal`.
  - In `reportController:145`: Fallback rounding uses `Math.round(x * 10) / 10` (1 decimal place) instead of 2 decimals.

- **Differing Code Side-by-Side:**
  ```typescript
  // calculateShiftAndOvertime (Lines 232-243)      // assignActivityBulk (Lines 922-927)
  if (shiftHours > 6.0) {                          } else if (newTotalHours > standardHoursCap) {
    daysWorked = 1.0;                                if (previousHours >= standardHoursCap) {
    regularHours = Math.min(shiftHours, 8.0);          overtimeHours = numHours;
    otHours = Math.round((shiftHours - 8.0) * 100) / 100; } else {
  } else {                                             overtimeHours = newTotalHours - standardHoursCap;
    daysWorked = 0.5;                                }
    regularHours = Math.min(shiftHours, 4.0);      } // NO HALF-DAY 4.0h CHECK!
    otHours = Math.round((shiftHours - 4.0) * 100) / 100;
  }
  ```

- **Concrete Bug Risk & Worked Example:**
  - **Employee:** Direct internal worker on a Wednesday.
  - **Hours Worked:** 5.0 effective hours (e.g. 07:00 to 13:00, with 1h lunch).
  - **Per Spec / `calculateShiftAndOvertime`:** Effective $\le$ 6h $\rightarrow$ Half Day (0.5). Base = 4.0h. $\text{OT} = 5.0 - 4.0 =$ **+1.0 hr OT**.
  - **Via `assignActivityBulk`:** Checks `5.0 > 8.0` (false) $\rightarrow \text{OT} =$ **0.0 hr OT**.
  - **Discrepancy:** The employee is shortchanged 1.0 hour of overtime pay because the entry was created through bulk activity allocation rather than the single check-out form.
- **Severity:** **HIGH** (Direct payroll distortion).
- **Proposed Single Home:** `backend/src/domain/time/overtimeEngine.ts`:
  `function calculateShiftAndOvertime(params: ShiftCalculationInput): ShiftCalculationResult`

---

### Finding 6: Day Type Resolution Ignores Database Calendar
- **Rule Name:** Calendar Day Type Resolution & Special Holiday Multipliers
- **Locations Found:**
  1. [`backend/src/controllers/calendarController.ts:52-90`](file:///g:/Maga-Frontend/backend/src/controllers/calendarController.ts#L52-L90) (`getDayTypeRulesAndId`)
  2. [`backend/src/controllers/reportController.ts:74-80`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L74-L80) (`getDayTypeRule`)
  3. [`backend/src/controllers/reportController.ts:956`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L956) (`getErpUploadReport`)
  4. [`frontend/src/utils/overtimeCalculator.ts:83-123`](file:///g:/Maga-Frontend/frontend/src/utils/overtimeCalculator.ts#L83-L123) (`getDayTypeRule`)

- **How the Implementations Differ:**
  - `calendarController.ts:52-90` correctly queries `prisma.mF_P_CalendarDay` for `(projectId, date)`. If found, it uses the project's calendar assignment (Poya, Public Holiday, Shutdown, etc.).
  - `reportController.ts:74-80` defines its own `getDayTypeRule`:
    ```typescript
    function getDayTypeRule(dateStr: string) {
      const d = new Date(dateStr);
      const dow = d.getDay();
      if (dow === 0) return { standardCap: 0, isAllOvertime: true, label: 'Sunday' };
      if (dow === 6) return { standardCap: 5.5, isAllOvertime: false, label: 'Saturday' };
      return { standardCap: 8.0, isAllOvertime: false, label: 'Normal Day' };
    }
    ```
    **It never queries `mF_P_CalendarDay` or `mF_G_DayType`!** Every Poya Day and Public Holiday configured in the system that falls on a Monday–Friday is treated by `reportController` as a "Normal Day" with standard cap 8.0!

- **Concrete Bug Risk & Worked Example:**
  - Date: Poya Day on a Thursday (e.g. 2026-05-28). Worker works 8.0 hours.
  - In Calendar Table: Configured as `POYA` (`rateMultiplier: 2.0`, `isAllOvertime: true`, `standardHoursCap: 0.0`).
  - Stored in `TimeEntry`: 8.0 hours of OT.
  - In `getErpUploadReport` and `getSummaryReport`: Calls `getDayTypeRule("2026-05-28")` $\rightarrow$ Day of week is 4 (Thursday) $\rightarrow$ Standard Cap = 8.0h, `isAllOvertime = false`.
  - Result: Overtime is calculated as $8.0 - 8.0 =$ **0.0 OT hours**! The worker receives 0 OT for working on a sacred Poya holiday in the ERP export!
- **Severity:** **HIGH** (Breaks statutory Sri Lankan holiday overtime compensation).
- **Proposed Single Home:** `backend/src/domain/calendar/dayTypeService.ts`:
  `async function resolveDayTypeForDate(projectId: string, date: Date): Promise<DayTypeRule>`

---

### Finding 7: Daily Assignment Uniqueness Bypassed by Copy APIs
- **Rule Name:** One Supervisor per Employee per Date (Single Assignment Invariant)
- **Locations Found:**
  1. [`frontend/dev-system-spec.md:165`](file:///g:/Maga-Frontend/frontend/dev-system-spec.md#L165) (`UNIQUE (tenant_id, date, employee_id)`)
  2. [`backend/prisma/schema.prisma:420`](file:///g:/Maga-Frontend/backend/prisma/schema.prisma#L420) (`@@unique([dailySheetId, employeeId])`)
  3. [`backend/src/controllers/assignmentController.ts:225-235`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L225-L235) (`assignEmployees`)
  4. [`backend/src/controllers/assignmentController.ts:374-383`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L374-L383) (`copyGangsFromDate`)
  5. [`backend/src/controllers/assignmentController.ts:944-960`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L944-L960) (`copyOperatorGangsFromDate`)
  6. [`backend/src/controllers/timeEntryController.ts:3197-3217`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3197-L3217) (`saveBulkLaborTimeEntries`)

- **How the Implementations Differ:**
  - `dev-system-spec.md` specifies a composite unique index on `(tenant_id, date, employee_id)`.
  - In `schema.prisma:420`, the constraint is only `@@unique([dailySheetId, employeeId])`. Because each supervisor has their own `dailySheetId` on that date, the database permits multiple supervisors to hold the same worker simultaneously.
  - `assignEmployees` attempts to enforce this in application code:
    ```typescript
    await prisma.mF_OP_DailyAssignment.deleteMany({
      where: {
        employeeId: { in: validLaborIds },
        dailySheet: { projectId, date: targetDate, id: { not: dailySheet.id } }
      }
    });
    ```
  - `copyGangsFromDate` and `copyOperatorGangsFromDate` **completely omit this deletion check**. They execute `createMany` with `skipDuplicates: true` scoped only to `targetSheet.id`.

- **Concrete Bug Risk & Worked Example:**
  - On Date 1, Worker `E001` is assigned to Supervisor A.
  - On Date 2, Supervisor B assigns Worker `E001` individually.
  - Admin then runs "Copy Gangs from Date 1 to Date 2" for Supervisor A.
  - `copyGangsFromDate` inserts `E001` under Supervisor A's sheet.
  - **Result:** Worker `E001` is now concurrently assigned to both Supervisor A and Supervisor B on Date 2. Both supervisors record conflicting check-ins and hours.
- **Severity:** **HIGH** (Corrupts gang assignments and daily headcount integrity).
- **Proposed Single Home:**
  1. Database migration: Add partial unique index or constraint on `MF_OP_DailyAssignment(dailySheet.projectId, dailySheet.date, employeeId)`.
  2. Domain helper: `backend/src/domain/assignments/assignmentService.ts`:
     `async function reassignEmployeesToSheet(dailySheetId: string, employeeIds: string[]): Promise<void>`

---

### Finding 8: Hardcoded Magic Numbers (Divisor 8, Rate 1.5, Overhead 0.10)
- **Rule Name:** Hourly Rate Derivation, OT Multiplier, and Overhead Billing
- **Locations Found:**
  1. [`backend/src/controllers/reportController.ts:799-803`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L799-L803) (`getBpBillReport`)
  2. [`backend/src/controllers/reportController.ts:1548`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L1548) (`getTimeCardReport`)
  3. [`backend/src/controllers/corporateController.ts:2183`](file:///g:/Maga-Frontend/backend/src/controllers/corporateController.ts#L2183) (`createCorporateTradeGroup`)
  4. [`backend/src/controllers/corporateController.ts:2211`](file:///g:/Maga-Frontend/backend/src/controllers/corporateController.ts#L2211) (`updateCorporateTradeGroup`)
  5. [`backend/src/controllers/corporateController.ts:3833`](file:///g:/Maga-Frontend/backend/src/controllers/corporateController.ts#L3833) (`importTradeGroupsCsv`)
  6. [`backend/scripts/migrate_tg_daily_rates.js:15`](file:///g:/Maga-Frontend/backend/scripts/migrate_tg_daily_rates.js#L15)
  7. [`frontend/src/features/reports/components/BpBillTable.tsx:80`](file:///g:/Maga-Frontend/frontend/src/features/reports/components/BpBillTable.tsx#L80)

- **How the Implementations Differ:**
  - **Divisor 8:** Hardcoded across 6 backend files:
    `const hourlyRate = Math.round((emp.dailyRate / 8) * 100) / 100;`
    `Math.round(((newRate || 1400) / 8 * 1.5) * 100) / 100;`
  - **Multiplier 1.5:** Hardcoded in Time Card and Trade Group controllers, completely ignoring whether the day is Poya/Holiday (`rateMultiplier: 2.0`).
  - **Overhead 0.10:** Hardcoded inline as `0.10` in `reportController.ts:802`. If management alters contractor overhead to 12% or 15%, multiple files must be edited.
  - **Divisor 9 ambiguity:** The prompt notes that construction daily rates are sometimes based on a 9-hour on-site day (8h work + 1h lunch). Code uniformly uses 8, but this is undocumented in the spec.

- **Differing Code Side-by-Side:**
  ```typescript
  // reportController.ts:800-803                     // corporateController.ts:2211
  const hourlyRate = Math.round((emp.dailyRate / 8)   const newOtRate = Math.round(
    * 100) / 100;                                       ((newRate || 1400) / 8 * 1.5) * 100
  const overhead = Math.round(totalHourlyPayment      ) / 100;
    * 0.10 * 100) / 100;
  ```

- **Concrete Bug Risk & Worked Example:**
  - Daily Rate = LKR 2,500.00.
  - Divisor 8: Hourly Rate = $2500 / 8 = \text{LKR } 312.50$. For 100 hours = LKR 31,250.00 + 10% (LKR 3,125.00) = **LKR 34,375.00**.
  - If contract specifies Divisor 9: Hourly Rate = $2500 / 9 = \text{LKR } 277.78$. For 100 hours = LKR 27,778.00 + 10% (LKR 2,777.80) = **LKR 30,555.80**.
  - Discrepancy per worker per month: **LKR 3,819.20** over-billing!
- **Severity:** **HIGH** (Direct financial impact on billing and payroll).
- **Proposed Single Home:** `backend/src/domain/billing/ratesConfig.ts`:
  `export const BILLING_CONFIG = { DAILY_RATE_DIVISOR: 8, OVERHEAD_PERCENTAGE: 0.10, STANDARD_OT_MULTIPLIER: 1.5 };`
  `function calculateHourlyAndOverhead(dailyRate: number, totalHours: number): BillingBreakdown`

---

### Finding 9: ZIDLE Remainder Shortage Duplicated Across 4 Places
- **Rule Name:** Shift Attendance Shortage Auto-Balancing (ZIDLE)
- **Locations Found:**
  1. [`backend/src/controllers/timeEntryController.ts:1334-1358`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1334-L1358) (`submitDay`)
  2. [`backend/src/controllers/timeEntryController.ts:2098-2122`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L2098-L2122) (`approveTimeEntries`)
  3. [`backend/src/controllers/timeEntryController.ts:3497-3518`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3497-L3518) (`saveBulkLaborTimeEntries`)
  4. [`backend/src/controllers/reportController.ts:1020-1034`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L1020-L1034) (`getErpUploadReport`)

- **How the Implementations Differ:**
  - `submitDay` and `approveTimeEntries` check: `if (shortage > 0.05 && !hasZidle)`.
  - `saveBulkLaborTimeEntries` checks: `if (idleShortage > 0 && (isSheetLockedOrSubmitted || isDone))`. (Threshold `> 0` vs `> 0.05`).
  - `getErpUploadReport` calculates ZIDLE *in-memory* on the fly for the report rows. If an entry already had ZIDLE persisted in `MF_OP_LaborActivitySplit`, it skips adding it. But if an entry was created via `assignActivityBulk` (which never auto-balances), the report injects a row that doesn't exist in the database!

- **Concrete Bug Risk & Worked Example:**
  - Effective Shift = 8.0 hours. Split allocated to Activity A = 7.97 hours. Shortage = 0.03 hours (approx. 2 minutes).
  - In `saveBulkLaborTimeEntries`: `0.03 > 0` $\rightarrow$ Generates ZIDLE entry of 0.03 hrs.
  - In `submitDay` / `approveTimeEntries`: `0.03 > 0.05` is FALSE $\rightarrow$ Does NOT generate ZIDLE entry!
  - Result: Micro-shortages appear or disappear depending on which API endpoint touched the row last.
- **Severity:** **HIGH** (Exported ERP rows differ based on submission path).
- **Proposed Single Home:** `backend/src/domain/time/zidleEngine.ts`:
  `function calculateZidleShortage(shiftHours: number, splitHours: number[]): number`

---

## 3. Medium & Low Severity Findings

---

### Finding 10: Inconsistent Date Range Parsing & Timezone Boundaries
- **Locations:**
  - [`backend/src/controllers/assignmentController.ts:7-10`](file:///g:/Maga-Frontend/backend/src/controllers/assignmentController.ts#L7-L10) (`parseDate`)
  - [`backend/src/controllers/timeEntryController.ts:11-14`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L11-L14) (`parseDate`)
  - [`backend/src/controllers/reportController.ts:45-54`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L45-L54) (`buildDateFilter`)
  - [`backend/src/controllers/reportController.ts:57-71`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L57-L71) (`dateRange`)
  - [`backend/src/controllers/calendarController.ts:43-46`](file:///g:/Maga-Frontend/backend/src/controllers/calendarController.ts#L43-L46) (`parseCalendarDate`)
- **Differences:**
  - `timeEntryController.ts` parses `YYYY-MM-DD` using `Date.UTC(y, m - 1, d)`.
  - `reportController.ts:45-54` executes `new Date(dateFrom)` followed by `d.setHours(0, 0, 0, 0)`. In Asia/Colombo (UTC+5:30), `setHours` alters the UTC timestamp to `18:30:00` of the previous day!
  - `reportController.ts:66` hardcodes `dates.length < 31` inside the `while` loop, causing 31-day months (January, August, December) or multi-month report queries to silently truncate at 31 items.
- **Severity:** **MEDIUM**.
- **Proposed Single Home:** `backend/src/domain/common/dateUtils.ts`.

---

### Finding 11: Effective Daily Rate Fallback Copy-Pasted 7 Times
- **Locations:**
  - [`backend/src/controllers/reportController.ts:665-670`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L665-L670)
  - [`backend/src/controllers/reportController.ts:755`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L755)
  - [`backend/src/controllers/reportController.ts:1545-1548`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L1545-L1548)
  - [`backend/src/controllers/timeEntryController.ts:896-904`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L896-L904)
  - [`backend/src/controllers/timeEntryController.ts:1106-1108`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1106-L1108)
  - [`backend/src/controllers/timeEntryController.ts:2544`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L2544)
  - [`backend/src/controllers/timeEntryController.ts:3244-3252`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3244-L3252)
- **Differences:**
  - All 7 copies evaluate: `appliedDailyRate ?? employee.dailyRate ?? tradeGroup.standardDailyRate ?? defaultRate`.
  - In `timeEntryController:900`, default rate is `1400.0`. In `timeEntryController:2544` and `reportController:755`, operator default rate is `1600.0`.
  - In `reportController:1545`, it searches `timeEntries` for `snapEntry` with `appliedDailyRate > 0`, rather than trusting the employee's current record.
- **Severity:** **MEDIUM**.
- **Proposed Single Home:** `backend/src/domain/billing/ratesConfig.ts`:
  `function resolveEffectiveDailyRate(appliedDailyRate?: Decimal | number | null, empDailyRate?: Decimal | number | null, tgRate?: Decimal | number | null, isOperator?: boolean): number`

---

### Finding 12: Inconsistent Field Validations Across Endpoints
- **Locations:**
  - [`backend/src/controllers/timeEntryController.ts:846-850`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L846-L850) (`assignActivityBulk`)
  - [`backend/src/controllers/timeEntryController.ts:1064`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L1064) (`upsertTimeEntry`)
  - [`backend/src/controllers/timeEntryController.ts:2235`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L2235) (`adminAdjustWorkerTimeEntry`)
  - [`backend/src/controllers/timeEntryController.ts:3462`](file:///g:/Maga-Frontend/backend/src/controllers/timeEntryController.ts#L3462) (`saveBulkLaborTimeEntries`)
- **Differences:**
  - `assignActivityBulk`: Requires `parseFloat(hours) > 0`; returns 400 if `0` or negative.
  - `upsertTimeEntry`: Allows `0` hours.
  - `adminAdjustWorkerTimeEntry`: Allows raw float input without checking `isNaN` or upper bounds.
  - Nowhere is an upper bound (e.g. `hours <= 24.0`) validated in application code or DB.
- **Severity:** **MEDIUM**.
- **Proposed Single Home:** `backend/src/domain/validation/entryValidation.ts`.

---

### Finding 13: Query Duplication & Employee Filtering Divergence
- **Locations:**
  - [`backend/src/controllers/reportController.ts:150-169`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L150-L169) (`buildEmployeeFilter`)
  - [`backend/src/controllers/reportController.ts:280-290`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L280-L290)
  - [`backend/src/controllers/reportController.ts:701-711`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts#L701-L711)
  - [`backend/src/controllers/employeeController.ts:35-50`](file:///g:/Maga-Frontend/backend/src/controllers/employeeController.ts#L35-L50)
- **Differences:**
  - `buildEmployeeFilter` matches: `callingName`, `corporateEmployee.fullName`, `corporateEmployee.employeeCode`, `corporateEmployee.callingName`.
  - In lines 280-290 and 701-711, the inline filter omits `corporateEmployee.callingName`.
  - `employeeController.ts` implements a different search predicate for the same employee keyword search.
- **Severity:** **MEDIUM**.
- **Proposed Single Home:** `backend/src/domain/employees/employeeFilters.ts`.

---

### Finding 14: Constants & Status Strings Scattered as Raw Literals
- **Locations:** Spread across all 14 controller files and seed scripts.
- **Raw Literals Found:**
  - Entry/Sheet Statuses: `'draft'`, `'submitted'`, `'approved'`, `'rejected'`, `'logged'`, `'assigned'`
  - Lifecycle Statuses: `'active'`, `'transferred'`, `'released'`, `'pending'`, `'HOLD_PENDING_HO_APPROVAL'`, `'PAYABLE'`
  - Roles: `'admin'`, `'supervisor'`, `'super_admin'`
  - Day Types: `'NORMAL'`, `'SATURDAY'`, `'SUNDAY'`, `'POYA'`, `'PUBLIC_HOLIDAY'`, `'HOLIDAY'`, `'SHUTDOWN'`, `'SPECIAL'`
  - Special Activity Codes: `'ZIDLE'`, `'OT'`, `'GEN-01'`, `'Idle / Unallocated Hours'`
- **Severity:** **MEDIUM**.
- **Proposed Single Home:** `backend/src/domain/constants/index.ts`.

---

### Finding 15: Client-Side Excel Generation Parity Risk
- **Locations:**
  - [`backend/src/controllers/reportController.ts`](file:///g:/Maga-Frontend/backend/src/controllers/reportController.ts) (JSON endpoints)
  - [`frontend/src/features/reports/services/excelExport.ts`](file:///g:/Maga-Frontend/frontend/src/features/reports/services/excelExport.ts) (Excel generator)
- **Differences:**
  - The backend produces JSON; Excel generation was moved to the frontend via `ExcelJS`.
  - `excelExport.ts:841-842` independently iterates over rows and computes `grandTotalHours` and `grandTotalOtHours` via client-side summation rather than binding to `data.totalHours`.
  - In `DayOtSummaryTable.tsx:474`: `item.totalWorkHours ?? item.totalDays` substitutes total days if work hours is null.
- **Severity:** **MEDIUM**.
- **Mitigation:** The frontend relies on backend JSON as the authoritative feed, but should bind to precomputed backend totals instead of re-summing.

---

### Finding 16: Missing Database Constraints for Application Invariants
- **Locations:** [`backend/prisma/schema.prisma`](file:///g:/Maga-Frontend/backend/prisma/schema.prisma)
- **Missing Constraints:**
  1. No unique constraint on `(projectId, date, employeeId)` across daily sheets.
  2. No DB-level check constraint on `hours` (`hours >= 0 AND hours <= 24.0`).
  3. No enum or check constraints on `role`, `status`, or `workerType`.
  4. Cascade deletion in application code: `unassignEmployee` deletes non-approved time entries.
- **Severity:** **HIGH**.
- **Proposed Single Home:** Prisma migrations adding DB constraints and enum types.

---

## 4. Proposed Shared Domain Layer

To eliminate copies and enforce DRY, the following pure domain modules and signatures should be introduced under `backend/src/domain/`:

```
backend/src/domain/
├── constants/
│   └── index.ts               # Enums, statuses, roles, day type codes, magic codes
├── tenant/
│   └── tenantContext.ts       # getAuthorizedProjectId(req)
├── auth/
│   └── ownershipGuard.ts      # assertSupervisorOwnership(req, supervisorId)
├── time/
│   ├── breakCalculator.ts     # calculateBreakHours(inTime, outTime, policy)
│   ├── overtimeEngine.ts      # calculateShiftAndOvertime(params)
│   └── zidleEngine.ts         # calculateZidleShortage(shiftHours, splitHours[])
├── calendar/
│   └── dayTypeService.ts      # resolveDayTypeForDate(projectId, date)
├── billing/
│   └── ratesConfig.ts         # resolveEffectiveDailyRate(), calculateHourlyAndOverhead()
├── locks/
│   └── dayLockService.ts      # assertDayNotLocked(projectId, date, employeeId)
└── common/
    └── dateUtils.ts           # parseDateUtc(str), getDaysInMonth(year, month), formatDateRange()
```

### Module Specifications & Signatures

1. **`constants/index.ts`**
   ```typescript
   export const ENTRY_STATUS = {
     DRAFT: 'draft',
     SUBMITTED: 'submitted',
     APPROVED: 'approved',
     REJECTED: 'rejected',
   } as const;

   export const DAY_TYPE_CODES = {
     NORMAL: 'NORMAL',
     SATURDAY: 'SATURDAY',
     SUNDAY: 'SUNDAY',
     POYA: 'POYA',
     PUBLIC_HOLIDAY: 'PUBLIC_HOLIDAY',
     SHUTDOWN: 'SHUTDOWN',
   } as const;

   export const SPECIAL_ACTIVITY_CODES = {
     ZIDLE: 'ZIDLE',
     OT: 'OT',
     DEFAULT_GENERAL: 'GEN-01',
   } as const;
   ```
   *Replaces:* Raw strings in 14 controllers, seed scripts, and routes.

2. **`tenant/tenantContext.ts`**
   ```typescript
   export function getAuthorizedProjectId(req: Request): string;
   ```
   *Replaces:* 40+ copies of `req.resolvedProjectId || req.resolvedTenantId || ... || getDefaultTenantId()`, and replaces `reportController.ts:resolveProjectId`.

3. **`time/breakCalculator.ts`**
   ```typescript
   export interface BreakCalculationResult {
     breakHours: number;
     isLunchDeducted: boolean;
     isDinnerDeducted: boolean;
   }
   export function calculateBreakHours(
     inTime?: string | null,
     outTime?: string | null,
     policy?: SiteMealPolicy
   ): BreakCalculationResult;
   ```
   *Replaces:* `timeEntryController.ts:computeBreakHoursAndSnapshots`, `reportController.ts:114-124`, `reportController.ts:969-975`, `overtimeCalculator.ts:calculateBreakHours`.

4. **`time/overtimeEngine.ts`**
   ```typescript
   export interface ShiftCalculationInput {
     inTime?: string | null;
     outTime?: string | null;
     explicitHours?: number;
     additionalHours?: number;
     standardCap: number;
     isAllOvertime: boolean;
     isSaturday: boolean;
     isExternal: boolean;
     policy?: SiteMealPolicy;
   }
   export interface ShiftCalculationOutput {
     shiftHours: number;
     otHours: number;
     breakHours: number;
     regularHours: number;
     daysWorked: number;
     isLunchDeducted: boolean;
     isDinnerDeducted: boolean;
   }
   export function calculateShiftAndOvertime(input: ShiftCalculationInput): ShiftCalculationOutput;
   ```
   *Replaces:* Duplicated OT arithmetic in `timeEntryController.ts:172`, `assignActivityBulk:920`, `upsertTimeEntry:1124`, `saveBulkLaborTimeEntries:3304`, `calendarController.ts:116`, `reportController.ts:83`, and `reportController.ts:1037`.

5. **`calendar/dayTypeService.ts`**
   ```typescript
   export interface DayTypeRule {
     effectiveDayTypeId: string;
     code: string;
     name: string;
     rateMultiplier: number;
     standardHoursCap: number;
     isAllOvertime: boolean;
     isSaturday: boolean;
     isSunday: boolean;
   }
   export async function resolveDayTypeForDate(projectId: string, date: Date): Promise<DayTypeRule>;
   ```
   *Replaces:* `calendarController.ts:getDayTypeRulesAndId`, `reportController.ts:getDayTypeRule`, `frontend/overtimeCalculator.ts:getDayTypeRule`.

6. **`billing/ratesConfig.ts`**
   ```typescript
   export const BILLING_CONFIG = {
     DAILY_RATE_DIVISOR: 8,
     OVERHEAD_PERCENTAGE: 0.10,
     DEFAULT_LABOR_DAILY_RATE: 1400.0,
     DEFAULT_OPERATOR_DAILY_RATE: 1600.0,
   } as const;

   export function resolveEffectiveDailyRate(
     appliedDailyRate?: number | Decimal | null,
     empDailyRate?: number | Decimal | null,
     tgDailyRate?: number | Decimal | null,
     isOperator?: boolean
   ): number;

   export function calculateHourlyAndOverhead(
     dailyRate: number,
     totalHours: number,
     divisor = BILLING_CONFIG.DAILY_RATE_DIVISOR,
     overheadRate = BILLING_CONFIG.OVERHEAD_PERCENTAGE
   ): { hourlyRate: number; totalHourlyPayment: number; overhead: number; totalCost: number };
   ```
   *Replaces:* 7 copies of daily rate fallback, `reportController.ts:800-803`, and `corporateController.ts` rate formulas.

7. **`locks/dayLockService.ts`**
   ```typescript
   export async function assertDayNotLocked(
     projectId: string,
     date: Date,
     employeeId?: string,
     supervisorId?: string
   ): Promise<void>;
   ```
   *Replaces:* Inline lock checks in `checkInEmployee`, `checkOutEmployee`, and adds missing guards to `assignActivityBulk`, `upsertTimeEntry`, `saveOperatorEntry`, and `saveBulkLaborTimeEntries`.

8. **`common/dateUtils.ts`**
   ```typescript
   export function parseDateUtc(dateStr: string): Date;
   export function buildUtcDateFilter(dateFrom?: string, dateTo?: string): { gte?: Date; lte?: Date } | undefined;
   export function getDateRangeList(from?: string, to?: string): string[];
   export function getDaysInMonthUtc(year: number, monthIndex: number): number;
   ```
   *Replaces:* `parseDate` in 3 controllers, `buildDateFilter` in `reportController`, `dateRange` in `reportController`, and calendar month boundary logic.

---

## 5. Behavior Differences That Would Change Results When Unified

When unifying the duplicated logic, the following calculations will change output compared to some current call sites:

1. **Shift Break Deduction on Short Shifts (Window vs 5h Threshold):**
   - *Current State:* `reportController` grants 0 break for shifts < 5h regardless of time of day. `timeEntryController` deducts 1 hour if the shift touches 12:00-13:00.
   - *Spec Document:* `frontend/dev-system-spec.md` and `timeEntryController` project meal policy is the intended design.
   - *Result When Unified:* Shifts crossing 12:00-13:00 will consistently have 1 hour deducted across all reports.
   - *Impact:* **Correct per system spec.**

2. **Poya & Holiday Overtime in Reports:**
   - *Current State:* `reportController` treats weekday Poya/Public Holidays as Normal Days (8.0h cap, 0 OT for 8h).
   - *Spec Document:* Appendix A & Section 3 state all holiday attendance is 100% overtime.
   - *Result When Unified:* Weekday holidays will produce 100% OT in ERP export and summary reports.
   - *Impact:* **Correct per system spec; fixes severe under-reporting bug.**

3. **Weekday Half-Day Overtime (<= 6.0h) in Bulk Assignment:**
   - *Current State:* `assignActivityBulk` checks `hours > 8.0`. A 5.0h shift gets 0 OT.
   - *Spec Document:* `Work Hours & Overtime (OT) Calculation Logic.md` explicitly defines $\le$ 6h as Half Day (base 4h), with $>4h \rightarrow +OT$.
   - *Result When Unified:* 5.0h weekday shift assigned via bulk API will correctly calculate $+1.0h$ OT.
   - *Impact:* **Correct per business rule document.**

4. **Negative Overtime for External Subcontractors:**
   - *Current State:* `calendarController:recalculateUnapprovedEntriesForDate` deducts negative OT on Saturday/Weekday for subcontractors.
   - *Spec Document:* Subcontractors are billed purely on actual hours; negative OT is prohibited.
   - *Result When Unified:* Subcontractors will never have negative OT applied on calendar updates.
   - *Impact:* **Correct per subcontractor billing policy.**

5. **Daily Rate Divisor (8 vs 9) — NEEDS BUSINESS DECISION:**
   - *Current State:* All backend code divides daily rate by 8.
   - *Business Question:* Is standard labour billing calculated on an 8-hour divisor or a 9-hour divisor (to account for an unpaid 1-hour lunch break on site)?
   - *Status:* **NEEDS BUSINESS DECISION**. Do not alter divisor 8 without client sign-off.

6. **Days Counted on Half-Days in Reports — NEEDS BUSINESS DECISION:**
   - *Current State:* `reportController:getSummaryReport` and `getDayOtSummaryReport` increment `totalDays += 1` for any entry, even a 2.0h half-day or Sunday shift.
   - *Spec Document:* Spec states half-days count as `0.5` days, and Sundays count as `0.0` regular days.
   - *Status:* **NEEDS BUSINESS DECISION**. Should the "Days Worked" column show physical days attended (1) or payroll equivalent days (0.5 / 1.0 / 0.0)?

---

## 6. Missing Tests

The codebase currently contains **zero automated unit tests** for core business calculations. `backend/test_suite_runner.js` is merely an HTTP smoke test runner requiring a live running server.

### Critical Untested Rules:
1. **Midnight Crossover Break Overlap:** No test verifying an overnight shift (e.g. 19:00 to 05:00) correctly detects 22:00-23:00 dinner overlap (1h) and 0 lunch overlap.
2. **Half-Day vs Full-Day Threshold (6.0h):** No test verifying that 6.0h yields Half-Day (4h base $\rightarrow$ +2h OT) while 6.25h yields Full-Day (8h base $\rightarrow$ -1.75h deficit).
3. **External Subcontractor OT Clamping:** No test verifying external labor never receives negative OT.
4. **ZIDLE Balancing:** No test verifying that partial allocations generate the exact remainder shortage as ZIDLE.
5. **Day Lock Enforcement:** No test verifying that `/assign-activity`, `/upsert`, and `/labor/bulk` return 403 on submitted/approved sheets.
6. **Tenant Isolation:** No test verifying that a user with JWT for Tenant A cannot query or mutate records for Tenant B by passing headers or query params.

---

## 7. Recommended Refactor Order (Smallest & Safest First)

1. **Step 1: Domain Constants File (Zero Risk, High Clarity)**
   Create `backend/src/domain/constants/index.ts`. Replace raw string literals (`'draft'`, `'submitted'`, `'approved'`, `'ZIDLE'`, `'OT'`) across controllers.
2. **Step 2: Pure Domain Calculators + Unit Tests (Zero DB Risk)**
   Create `backend/src/domain/time/breakCalculator.ts` and `overtimeEngine.ts`. Write comprehensive Jest/Node unit tests covering normal, Saturday, Sunday, holiday, midnight crossover, and external subcontractor cases.
3. **Step 3: Centralized Date Utils (Low Risk)**
   Create `backend/src/domain/common/dateUtils.ts`. Unify `parseDateUtc`, `buildUtcDateFilter`, and fix the 31-day cap in `dateRange`.
4. **Step 4: Centralized Tenant Context & Route Authentication (Security Fix)**
   Create `backend/src/domain/tenant/tenantContext.ts`. Mount `requireAuth` across all unauthenticated time entry, assignment, and report routes in `timeEntryRoutes.ts`, `assignmentRoutes.ts`, `reportRoutes.ts`.
5. **Step 5: Unified Calendar Day Type Resolver (Medium Risk)**
   Unify `calendarController:getDayTypeRulesAndId` and `reportController:getDayTypeRule` into `backend/src/domain/calendar/dayTypeService.ts`. Fixes holiday OT in reports.
6. **Step 6: Unified Day Lock Service (Medium Risk)**
   Implement `backend/src/domain/locks/dayLockService.ts`. Add `assertDayNotLocked` to `assignActivityBulk`, `upsertTimeEntry`, `saveOperatorEntry`, and `saveBulkLaborTimeEntries`.
7. **Step 7: Rates & Billing Unification (Needs Business Decision on Divisor)**
   Extract rate fallback logic and overhead formula into `backend/src/domain/billing/ratesConfig.ts`.

---

## 8. Five-Line Plain-Text Summary of Worst Findings

1. Twelve critical time entry and assignment mutation routes have zero authentication middleware, allowing unauthenticated API clients to log, alter, and submit attendance.
2. All controllers accept unvalidated `projectId` and `tenantId` query parameters, and `reportController` queries arbitrary database projects when omitted, causing complete cross-tenant data leakage.
3. `reportController` completely ignores the database holiday calendar, hardcoding weekday holidays as normal workdays and wiping out holiday overtime in ERP exports and summary reports.
4. Day locking is completely bypassed by `assignActivityBulk` and `saveBulkLaborTimeEntries`, allowing supervisors to delete and rewrite activity splits of approved days.
5. Shift break deductions and overtime baselines are implemented differently in four locations, producing 1.0h attendance discrepancies and stripping half-day overtime in bulk workflows.
