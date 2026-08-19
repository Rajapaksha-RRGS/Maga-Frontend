# Dev System Spec
# Labour Entry System — Dev System Spec

> Reference document for building the system module by module. Follow this spec strictly for consistency across modules — same pattern used in Module 1 (Auth) applies to every subsequent module.

---

## 1. Project overview

A web-based labour entry / attendance system replacing a manual Excel workflow. Admin manages master data and daily supervisor-employee assignments. Supervisors log in daily, record In/Out time, activity code, and hours worked per assigned employee, then submit and lock the day. Admin can view or export consolidated reports (Employee, Date, Activity, Hours, Overtime, Remarks) at any time, with a full month-end Excel report.

**This is a multi-tenant SaaS product.** One shared database, one codebase, serving multiple companies (tenants) — e.g. Mäga Engineering, ABC Constructions — each isolated by a `tenant_id` on every core table. Site-level separation within a tenant is not in scope yet (see Section 8).

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS (responsive, mobile + desktop from one codebase) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt, role-based (`admin`, `supervisor`) |
| Excel export | `exceljs` |
| Packaging | Docker (frontend, backend, db as separate containers via `docker-compose`) — keeps deployment portable across AWS / Azure / GCP / self-hosted |

---

## 3. Database schema

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(150) NOT NULL,
  subdomain VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'maga' -> maga.yoursaas.com
  address_line1 VARCHAR(150),
  address_line2 VARCHAR(150),
  phone VARCHAR(50),
  fax VARCHAR(50),
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor')),
  employee_id UUID REFERENCES employees(id), -- nullable, only if supervisor is also a worker
  must_change_password BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (tenant_id, username) -- username unique within a tenant, not globally
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  calling_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(150),
  business_partner VARCHAR(100),
  trade_group VARCHAR(100),
  nic_no VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE activity_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  code VARCHAR(20) NOT NULL,
  description VARCHAR(150),
  UNIQUE (tenant_id, code)
);

CREATE TABLE day_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  name VARCHAR(30) NOT NULL, -- Normal Day, Sunday, Poya, Public Holiday
  rate_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0
);

CREATE TABLE calendar (
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  date DATE NOT NULL,
  day_type_id UUID REFERENCES day_types(id) NOT NULL,
  remarks VARCHAR(150),
  PRIMARY KEY (tenant_id, date) -- each tenant can have its own holiday calendar
);

CREATE TABLE daily_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  date DATE NOT NULL,
  supervisor_id UUID REFERENCES users(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  UNIQUE (tenant_id, date, employee_id) -- one employee, one supervisor per day, per tenant
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  supervisor_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  activity_id UUID REFERENCES activity_codes(id) NOT NULL,
  equipment_id UUID REFERENCES equipment(id),
  effective_day_type_id UUID REFERENCES day_types(id) NOT NULL, -- calendar default, overridable per entry
  in_time TIME,
  out_time TIME,
  hours DECIMAL(5,2),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  remarks VARCHAR(200),
  status VARCHAR(20) DEFAULT 'draft', -- draft | submitted
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_time_entries_tenant_date ON time_entries(tenant_id, date);
CREATE INDEX idx_assignments_tenant_date ON daily_assignments(tenant_id, date);
```

**Key relationships**
- `daily_assignments.supervisor_id` → `users.id` (the logged-in supervisor account, not an employee record)
- `users.employee_id` is nullable — only set when a supervisor is also a tracked worker
- `time_entries.effective_day_type_id` defaults from `calendar` on entry creation but can be overridden per employee per day (e.g. Sunday treated as Normal Day for a specific worker)
- An employee can have multiple `time_entries` rows on the same date if they worked multiple activity codes that day
- Every core table carries `tenant_id`. All previously-global unique constraints (username, activity code, calendar date) are now scoped to `(tenant_id, ...)` so two tenants can reuse the same username or activity code without conflict

**Tenant isolation (two layers)**
1. **App layer** — a backend middleware resolves `tenant_id` from the logged-in user's session (or subdomain) and injects it into every query automatically, so individual developers never have to remember to filter by hand.
2. **Database layer (optional, Supabase)** — Postgres Row Level Security (RLS) policies enforce the same isolation at the DB level as a second safety net, e.g. `USING (tenant_id = current_setting('app.current_tenant')::uuid)`.

**Login flow** — login now resolves the tenant first (via subdomain, e.g. `maga.yoursaas.com`, or a company selector on the login form), then authenticates the username/password within that tenant's scope.

---

## 4. Module list (build order)

1. Auth & login (JWT, role-based, `users` table)
2. Admin — master data (Employees, Equipment, Activity Codes)
3. Admin — calendar & day types
4. Admin — daily assignment (supervisor ↔ employee mapping)
5. Supervisor — time entry (In/Out/Activity/Hours, submit & lock)
6. Reporting & Excel export

---

## 5. Backend folder structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.routes.js
│   │   │   └── auth.middleware.js
│   │   ├── employees/
│   │   ├── equipment/
│   │   ├── activityCodes/
│   │   ├── calendar/
│   │   ├── assignments/
│   │   ├── timeEntries/
│   │   └── reports/
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── roleCheck.js
│   ├── utils/
│   │   └── excelExport.js
│   ├── app.js
│   └── server.js
├── migrations/
├── .env
├── package.json
└── Dockerfile
```

Each module folder follows the same 3-file pattern: `*.controller.js` (handles request/response), `*.service.js` (business logic + DB queries), `*.routes.js` (endpoint definitions).

---

## 6. Frontend folder structure (feature-based)

```
frontend/
├── src/
│   ├── features/
│   │   ├── auth/            { components/, hooks/, services/ }
│   │   ├── employees/       { components/, hooks/, services/ }
│   │   ├── equipment/       { components/, hooks/, services/ }
│   │   ├── activity-codes/  { components/, hooks/, services/ }
│   │   ├── calendar/        { components/, hooks/, services/ }
│   │   ├── assignments/     { components/, hooks/, services/ }
│   │   ├── time-entries/    { components/, hooks/, services/ }
│   │   └── reports/         { components/, hooks/, services/ }
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── EmployeesPage.tsx
│   │   ├── EquipmentPage.tsx
│   │   ├── ActivityCodesPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── AssignmentsPage.tsx
│   │   ├── TimeEntryPage.tsx
│   │   └── ReportsPage.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   └── DashboardLayout.tsx
│   ├── components/     # shared/generic only (Button, Table, Modal)
│   ├── hooks/           # shared only (useDebounce, usePagination)
│   ├── lib/              # axios instance, constants, helpers
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── Dockerfile
```

Rule: `pages/*` only assembles components from `features/*` — no business logic inside a page file. Backend module names and frontend feature names match 1:1.

---

## 7. UI/UX decisions locked in

- **Supervisor time entry screen**: assigned employees shown as a card list. Tapping a card expands it accordion-style in place to reveal the In/Out/Activity form — no modal, no route change. Saving an entry auto-collapses the card and shows a saved indicator (e.g. checkmark) on the card.
- **Day type**: system auto-fills `effective_day_type_id` from the `calendar` table for the selected date, shown as a badge (e.g. "Sunday — OT applies"). Supervisor can override it per employee per entry.
- **Assignment screen**: admin can bulk-copy the previous day's assignment and edit individually, or bulk-assign by trade group / business partner.

---

## 8. Future extensions (not in current scope, schema-compatible)

- Site-level separation within a tenant: add `sites` table + `site_id` FK on `employees`, `daily_assignments`, `time_entries` — for tenants running multiple project locations under one company.

---

## Appendix A — Product Discovery (SB7)

> Adapted from the StoryBrand 7-part framework (originally used for client website discovery) to define the product narrative for this system. `client_confidence: "high"` because this was built from detailed real-world requirements gathering, not assumptions.

```json
{
  "business": {
    "name": "Labour Entry System",
    "industry": "Construction / Engineering labour & attendance management (SaaS)",
    "market": "LK",
    "website_type": "SaaS web application (not a marketing website)"
  },
  "sb7": {
    "hero_want": "Admins want to track daily labour attendance and activity hours accurately, without manual Excel work, and get error-free payroll reports instantly.",
    "villain": "The manual Excel-based Labour Entry Sheet — slow, error-prone, hard to consolidate across many supervisors and hundreds of employees every month.",
    "internal_problem": "Admins feel overwhelmed and anxious at month-end, worried about payroll mistakes, losing time chasing supervisors for data, and having no real-time visibility into who worked where and for how long.",
    "authority": "Designed directly from the client's own real Labour Entry Sheet and real business rules — daily-changing supervisor-to-employee assignments, per-activity hour splits, and day-type (Sunday/Poya/Holiday) overtime rate overrides — not a generic template.",
    "plan_steps": [
      "Admin sets up employees, activity codes, equipment, and assigns employees to supervisors each day",
      "Supervisors log in daily (any device) and record In/Out time, activity, and hours per employee, then submit and lock the day",
      "Admin views work details anytime and gets an accurate, consolidated Excel report automatically at month-end"
    ],
    "failure_stakes": "Continued reliance on error-prone spreadsheets — miscalculated payroll, disputes with employees over hours worked, and hours of admin time lost every month manually consolidating scattered sheets.",
    "success_vision": "Month-end payroll report generates itself in seconds with zero manual consolidation, correct overtime/holiday rates applied automatically, and full visibility into every employee's work history — for every client company running on the platform."
  },
  "client_confidence": "high",
  "persona_count": 2,
  "general_remarks": "Multi-tenant SaaS: this narrative applies per tenant company (e.g. Mäga Engineering), not to a single client. Two core personas: (1) Admin — desktop-first, sets up data and reviews reports; (2) Supervisor — mobile-first, field-based, needs a fast low-friction daily entry flow (accordion card UI)."
}
```
## Section 7 — UI/UX Decisions

### Design System Reference

All new components **must** read `frontend/design-system.json` before styling
anything. The file is the single source of truth for every color, spacing
value, border-radius, font-weight, and component pattern used in this app.

**Rules:**

1. **No new tokens.** Any new color, spacing, or radius value that does not
   already appear in `design-system.json` must be treated as a **bug**, not a
   new design option. If a genuinely new token is needed, add it to
   `design-system.json` first, document the rationale, and get approval before
   using it in a component.

2. **Consistency enforcement.** When building a new screen or component,
   reference the `component_dna` section for the canonical styling of buttons,
   inputs, cards, chips, and rows. Do not reinvent these patterns — compose
   from the existing DNA.

3. **Accent discipline.** Blue-700 (`#1d4ed8`) is the sole interactive accent.
   It must not appear in body text, headings, or decorative elements. Green and
   amber are strictly semantic (success / warning) — never decorative.

4. **Typography guard-rails.** Only font-weights 400 and 500 are used. If a
   design mock shows bold (600+), translate it to 500 (medium). Labels use
   sentence case or uppercase-xs — never Title Case.

5. **Accessibility minimums.** Every tappable element must be ≥ 44px tall
   (`min-h-[44px]`), must have a `focus-visible:ring-2 ring-blue-600` ring,
   and must include `transition-colors` for press feedback.
