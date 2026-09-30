# 🏗️ MAGA Construction ERP & Site Operations Management System

[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%205-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor%20Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

An enterprise-grade, multi-tenant workforce, plant equipment, and daily construction site operations management platform built for **MAGA Engineering**. It bridges the gap between field site operations (Supervisors logging workforce hours, plant machinery, and fuel on mobile/tablet devices) and Head Office management (Site Admins, Project Directors, and Corporate SAP/ERP systems).

---

## 📑 Table of Contents

- [About the Platform](#-about-the-platform)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
  - [1. High-Level System Architecture](#1-high-level-system-architecture)
  - [2. Multi-Tenant & Corporate Master Data Sync](#2-multi-tenant--corporate-master-data-sync)
  - [3. Daily Site Operations Lifecycle Workflow](#3-daily-site-operations-lifecycle-workflow)
  - [4. Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
  - [5. Database Domain Model (ERD)](#5-database-domain-model-erd)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Mobile App (Capacitor Android)](#mobile-app-capacitor-android)
- [Environment Configuration](#-environment-configuration)
- [Business Logic & Overtime Rules](#-business-logic--overtime-rules)
- [ERP Integration & Reporting](#-erp-integration--reporting)
- [License](#-license)

---

## 💡 About the Platform

Construction projects operate in high-tempo, variable field environments where labor allocations, heavy machinery usage, fuel consumption, and subcontractor billing must be recorded accurately on a daily basis.

**MAGA Construction ERP** solves the delays and inaccuracies of paper-based timesheets by providing:

- **Site-Scoped Multi-Tenancy**: Every project site (e.g. _Project 531_, _Project 508_, _Marine Drive Package_) operates as an isolated tenant with its own dedicated supervisors, gangs, and equipment logs.
- **Corporate Master Catalog**: Centralized corporate registry of employees, heavy machinery, and standard activity codes that project sites can seamlessly sync and import into their local site roster.
- **Sri Lankan Statutory & Site OT Engine**: Built-in automated calculation of regular vs overtime hours based on day type rules (Normal 8h, Saturday 6h, Sunday 100% OT, Poya/Public Holidays, and Site Shutdowns).
- **ERP-Ready Export**: Generates validated SAP/ERP upload CSV/Excel files and dynamic visual running charts for audits and contractor claims.

---

## 🚀 Key Features

| Category                             | Highlights                                                                                                                                         |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🏢 Multi-Tenant Site Isolation**   | Complete tenant partition per construction project; dedicated Project Admin credentials; custom subdomains and site metadata.                      |
| **📦 Corporate Master Sync**         | One-click import and batch-sync from Central Corporate Catalog for Employees, Heavy Equipment, and Standard Activity Codes.                        |
| **👷 Daily Labor Gang Allocation**   | Allocate direct and subcontractor labor to supervisors; filter by trade groups; quick copy gangs from past dates; separate operator & driver pool. |
| **🚜 Plant & Machinery Allocation**  | Assign company-owned or hired heavy equipment (Excavators, Cranes, Dump Trucks) and certified operators to site sectors.                           |
| **📱 Mobile-First Field Logging**    | Field supervisor view for daily labor check-in/out, activity code hour splits, equipment working hours, breakdown hours, and fuel logs.            |
| **⏱️ Automated OT Engine**           | Compliance with Sri Lankan labor standards: weekday 8h cap, Saturday 6h cap, 100% OT on Sundays and Poya/Public holidays.                          |
| **✅ Multi-Stage Approval Workflow** | Supervisor submit ➔ Admin review with inline adjustments ➔ One-click approval ➔ Immutable lock on daily time sheets.                               |
| **📊 ERP Upload & Analytics**        | Interactive dashboard with live man-hour charts, activity code distribution, equipment running charts, and Excel/CSV ERP exports.                  |

---

## 🏛️ System Architecture

### 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Presentation & Field Clients Layer"]
        direction TB
        WebApp["💻 Web Application\n(React 19 + TypeScript + Vite + Tailwind CSS)"]
        MobileApp["📱 Field Mobile / Tablet App\n(Capacitor Android + Offline Caching)"]
    end

    subgraph GatewayLayer["🛡️ Security & API Gateway Layer"]
        direction TB
        AuthMid["JWT Auth Middleware\n(Token Validation & Password Reset Guard)"]
        TenantMid["Multi-Tenant Resolver\n(Tenant Header / Subdomain / User Context)"]
        RateLimit["CORS & Request Sanitize"]
    end

    subgraph ServiceLayer["⚙️ Core Application Services (Node.js & Express 5)"]
        direction TB
        AuthController["Auth & Project Controller"]
        LaborService["Labor & Gang Allocation Service"]
        OperatorService["Operator & Plant Machine Service"]
        TimeEntryEngine["Time Entry & Work Log Service"]
        RuleEngine["Sri Lankan OT & Calendar Engine"]
        ApprovalService["Approval & Audit Trail Service"]
        ReportService["ERP Export & Analytics Service"]
        CorporateSyncService["Corporate Catalog Sync Service"]
    end

    subgraph DataLayer["🗄️ Persistence & Database Layer"]
        direction TB
        PrismaORM["Prisma ORM 6\n(Schema Validation & Relation Mapping)"]
        PostgresDB[("🐘 PostgreSQL Database\n(Row-Level Tenant Isolation)")]
    end

    subgraph ExternalERP["🏢 External Systems"]
        CorporateERP["MAGA Corporate SAP / ERP\n(Master Catalog & Daily Payroll Upload)"]
    end

    WebApp -->|HTTPS / REST API| GatewayLayer
    MobileApp -->|HTTPS / REST API| GatewayLayer
    GatewayLayer --> ServiceLayer
    ServiceLayer --> PrismaORM
    PrismaORM --> PostgresDB
    CorporateSyncService <-->|Catalog Fetch / Batch Sync| CorporateERP
    ReportService -->|CSV / XLSX Export| CorporateERP
```

---

### 2. Multi-Tenant & Corporate Master Data Sync

Each construction site operates as an autonomous project tenant, while retaining synchronized links to MAGA Corporate Master Data:

```mermaid
graph LR
    subgraph CorporateMaster["🏢 Central MAGA Corporate Master"]
        CorpEmps["Corporate Employees\n(Direct & Subcontractor Roster)"]
        CorpEquip["Corporate Equipment Fleet\n(Company Machinery & Hired Plant)"]
        CorpActivities["Corporate Activity Codes\n(Standard BOQ & Cost Codes)"]
    end

    subgraph SyncEngine["🔄 Master Sync & Import Engine"]
        BatchImporter["Corporate Batch Importer\n(/api/activity-codes/import-from-corporate)\n(/api/employees/import-from-corporate)"]
        FilterRules["Duplicate & Unique Identifier Check\n(EPF, NIC, Registration No, Code)"]
    end

    subgraph ProjectSites["🏗️ Autonomous Project Sites (Multi-Tenants)"]
        subgraph TenantA["Tenant: Project 531 (Water Supply)"]
            SiteEmpsA["Site Labor & Operators"]
            SiteEquipA["Site Machinery Fleet"]
            SiteCodesA["Project Activity Codes"]
        end
        subgraph TenantB["Tenant: Project 508 (Highway)"]
            SiteEmpsB["Site Labor & Operators"]
            SiteEquipB["Site Machinery Fleet"]
            SiteCodesB["Project Activity Codes"]
        end
    end

    CorporateMaster --> SyncEngine
    SyncEngine -->|Selective Import| TenantA
    SyncEngine -->|Selective Import| TenantB
```

---

### 3. Daily Site Operations Lifecycle Workflow

From morning roll-call to final corporate ERP synchronization:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 👨‍💼 Site Admin
    actor Sup as 👷 Site Supervisor
    participant Backend as ⚙️ Backend API
    participant DB as 🗄️ PostgreSQL
    actor ERP as 📊 MAGA ERP / Accounts

    Note over Admin,Sup: Phase 1: Morning Roll Call & Gang Assignment
    Admin->>Backend: Allocate Labor Gangs & Machinery for Date
    Backend->>DB: Upsert DailyAssignment & OperatorAssignment

    Note over Sup,Backend: Phase 2: Site Work & Field Logging
    Sup->>Backend: Check-in assigned workers & operators
    Sup->>Backend: Allocate working hours across Activity Codes (Normal + OT)
    Sup->>Backend: Log equipment meter (Start/End), idle/breakdown, and fuel received
    Sup->>Backend: Submit daily time sheet (Locks Supervisor editing)
    Backend->>DB: Status: "draft" ➔ "submitted"

    Note over Admin,Backend: Phase 3: Site Admin Review & Verification
    Admin->>Backend: Inspect submitted time sheets & machine logs
    Admin->>Backend: Optional: Adjust hours / OT split with audit log
    Admin->>Backend: Approve Time Entries
    Backend->>DB: Status: "submitted" ➔ "approved"

    Note over Admin,ERP: Phase 4: Payroll & ERP Export
    Admin->>Backend: Generate ERP Upload Format (CSV / Excel)
    Backend->>ERP: Feed approved daily hours, OT, plant logs & fuel into SAP/ERP
```

---

### 4. Role-Based Access Control (RBAC)

```mermaid
graph TD
    classDef superAdmin fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef admin fill:#dbeafe,stroke:#2563eb,stroke-width:2px;
    classDef supervisor fill:#dcfce7,stroke:#16a34a,stroke-width:2px;

    User([User Authentication]) --> RoleCheck{User Role}

    RoleCheck -->|super_admin| SA[👑 Super Admin]::superAdmin
    RoleCheck -->|admin| PA[👨‍💼 Project Site Admin]::admin
    RoleCheck -->|supervisor| SS[👷 Field Supervisor]::supervisor

    subgraph SuperAdminPrivileges["Super Admin Capabilities"]
        SA --> SA1["Register New Construction Project Sites (Tenants)"]
        SA --> SA2["Provision Initial Project Site Admins"]
        SA --> SA3["Global Multi-Project Overview & Tenant Status"]
    end

    subgraph AdminPrivileges["Site Admin Capabilities"]
        PA --> PA1["Import/Manage Employees, Equipment, Business Partners"]
        PA --> PA2["Define Daily Gangs, Operator & Machinery Allocations"]
        PA --> PA3["Manage Project Calendar & Overtime Rules"]
        PA --> PA4["Review, Adjust, & Approve Daily Sheets"]
        PA --> PA5["Generate Running Charts & SAP/ERP Upload Files"]
    end

    subgraph SupervisorPrivileges["Field Supervisor Capabilities"]
        SS --> SS1["View Daily Assigned Labor Gang & Assigned Plant"]
        SS --> SS2["Worker Check-In / Check-Out"]
        SS --> SS3["Multi-Activity Work Hour Distribution"]
        SS --> SS4["Heavy Equipment Operating / Idle / Breakdown & Fuel Logs"]
        SS --> SS5["Submit Final Daily Timesheet"]
    end
```

---

### 5. Database Domain Model (ERD)

```mermaid
erDiagram
    TENANT ||--o{ USER : contains
    TENANT ||--o{ EMPLOYEE : employs
    TENANT ||--o{ EQUIPMENT : owns_rents
    TENANT ||--o{ BUSINESS_PARTNER : engages
    TENANT ||--o{ ACTIVITY_CODE : uses
    TENANT ||--o{ CALENDAR_DAY : configures
    TENANT ||--o{ DAILY_ASSIGNMENT : schedules
    TENANT ||--o{ TIME_ENTRY : records

    USER {
        string id PK
        string tenantId FK
        string username
        string role "super_admin | admin | supervisor"
        string fullName
        boolean mustChangePassword
    }

    EMPLOYEE {
        string id PK
        string tenantId FK
        string employeeCode
        string callingName
        string fullName
        string tradeGroup
        boolean isOperator
        string status "active | inactive"
    }

    EQUIPMENT {
        string id PK
        string tenantId FK
        string equipmentCode
        string registrationNo
        string name
        string ownershipType "company | hired"
        string condition
    }

    BUSINESS_PARTNER {
        string id PK
        string tenantId FK
        string code
        string name
        string type "internal | subcontractor | supplier"
    }

    DAILY_ASSIGNMENT {
        string id PK
        string tenantId FK
        date date
        string supervisorId FK
        string employeeId FK
    }

    TIME_ENTRY {
        string id PK
        string tenantId FK
        date date
        string employeeId FK
        string supervisorId FK
        string activityId FK
        decimal hours
        decimal overtimeHours
        string status "draft | submitted | approved"
    }

    EQUIPMENT_DAILY_LOG {
        string id PK
        string tenantId FK
        date date
        string equipmentId FK
        string operatorId FK
        decimal startMeter
        decimal endMeter
        decimal operatingHours
        decimal breakdownHours
        decimal idleHours
        decimal fuelReceived
    }

    EQUIPMENT ||--o{ EQUIPMENT_DAILY_LOG : logs
    EMPLOYEE ||--o{ TIME_ENTRY : works
    USER ||--o{ DAILY_ASSIGNMENT : manages
```

---

## 💻 Tech Stack

### Frontend

- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) + Custom Executive Soft Pastel Theme
- **Icons**: [Lucide React](https://lucide.dev/)
- **Spreadsheet / Reporting Engine**: [ExcelJS](https://github.com/exceljs/exceljs)
- **Mobile Runtime**: [Capacitor 8](https://capacitorjs.com/) (Android native build support)
- **Client Cache**: Custom Memory Cache Manager with time-to-live (TTL) invalidation

### Backend

- **Runtime**: [Node.js](https://nodejs.org/) (ES2022+ / CommonJS target)
- **Framework**: [Express 5](https://expressjs.com/) + TypeScript
- **Database ORM**: [Prisma 6](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Supabase / Local Postgres supported)
- **Authentication**: JWT (`jsonwebtoken`) + Salted Hashing (`bcrypt`)
- **Execution & Watch**: `tsx` (TypeScript Execute)

---

## 📂 Project Directory Structure

```text
Maga-Frontend/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # Database models (Tenants, Users, Employees, Equip, Logs)
│   │   ├── seed.ts                    # Initial development database seed
│   │   └── seed-all-master-data.ts    # Comprehensive MAGA master data seeder
│   ├── src/
│   │   ├── config/
│   │   │   └── prisma.ts              # Global Prisma Client instance
│   │   ├── controllers/
│   │   │   ├── activityCodeController.ts
│   │   │   ├── assignmentController.ts # Labor, Operator & Machinery assignments
│   │   │   ├── authController.ts       # Login, Project Registration, Password reset
│   │   │   ├── businessPartnerController.ts
│   │   │   ├── employeeController.ts   # Site roster & Corporate catalog sync
│   │   │   ├── equipmentController.ts  # Plant fleet & Corporate machinery sync
│   │   │   ├── reportController.ts     # ERP upload file generator & Running charts
│   │   │   └── timeEntryController.ts  # Labor time logs & Equipment daily sheets
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts       # JWT verification & password-change guard
│   │   │   └── tenantResolver.ts       # Multi-tenant context extraction
│   │   ├── routes/                     # Express REST route endpoints
│   │   └── server.ts                   # Main Express application entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── android/                        # Capacitor Android native project
│   ├── src/
│   │   ├── components/                 # Reusable UI widgets (Modals, Badges, Tables)
│   │   ├── config/
│   │   │   └── api.ts                  # Axios/Fetch API base URL & Tenant interceptor
│   │   ├── features/
│   │   │   ├── activity-codes/         # Activity codes management & corporate import
│   │   │   ├── assignments/            # Labor gang allocation & past gang copy
│   │   │   ├── dashboard/              # Executive KPI cards, Live Activity hours panel
│   │   │   ├── employees/              # Employee roster, Operator filtering, Deactivation
│   │   │   ├── equipment/              # Machinery management & fleet tracking
│   │   │   ├── master-import/          # Central Corporate Master import UI modal
│   │   │   ├── supervisor/             # Mobile field supervisor views (Labor & Equip)
│   │   │   └── time-entries/           # Time sheet records & bulk entry tools
│   │   ├── pages/                      # Page components (AdminDashboard, Reports, etc.)
│   │   ├── utils/                      # Cache manager, date helpers, CSV/Excel helpers
│   │   ├── App.tsx                     # Top-level routing & Protected route guards
│   │   └── main.tsx                    # React DOM root entry
│   ├── capacitor.config.ts             # Capacitor mobile configuration
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── maga_erp_master_data_clean.md       # Master data clean reference catalog
└── README.md                           # Documentation & Architecture overview
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14.0 or higher (or cloud PostgreSQL instance like Supabase / Neon)
- **Android Studio** _(Optional, only if building the native mobile APK)_

---

### Backend Setup

1. **Navigate to the backend directory**:

   ```bash
   cd backend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `backend/`:

   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/maga_erp?schema=public"
   JWT_SECRET="your_super_secret_jwt_key_here"
   DEFAULT_TENANT_ID="your-default-tenant-uuid"
   ```

4. **Initialize Database Schema**:

   ```bash
   npm run prisma:push
   ```

5. **Seed Master Data**:

   ```bash
   npm run seed
   ```

6. **Start Backend Server**:
   ```bash
   npm run dev
   # API will be active on http://localhost:5000
   ```

---

### Frontend Setup

1. **Navigate to the frontend directory**:

   ```bash
   cd frontend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `frontend/`:

   ```env
   VITE_API_URL="http://localhost:5000/api"
   ```

4. **Start Vite Development Server**:
   ```bash
   npm run dev
   # Web application will be active on http://localhost:5173
   ```

---

### Mobile App (Capacitor Android)

To build the field supervisor app for Android tablets/smartphones:

```bash
cd frontend

# 1. Build the web distribution bundle
npm run build

# 2. Sync web bundle to Android native project
npm run cap:sync

# 3. Open in Android Studio to run on physical device or emulator
npm run cap:open
```

---

## ⚙️ Configuration & Roles

### Default User Roles & Initial Access

| Role          | Default Access        | Description                                                                                            |
| :------------ | :-------------------- | :----------------------------------------------------------------------------------------------------- |
| `super_admin` | Global / Multi-Tenant | Super Admin with authority to register new construction sites and site admins.                         |
| `admin`       | Tenant-Scoped         | Site Project Director / Site Engineer managing master data, daily rosters, approvals, and ERP exports. |
| `supervisor`  | Tenant-Scoped         | Field Foreman / Supervisor recording daily labor check-ins, activity hour splits, and machine logs.    |

---

## ⚖️ Business Logic & Overtime Rules

The platform automatically classifies working hours into **Normal Hours** and **Overtime (OT)** based on project calendar rules:

| Day Type                       | Standard Hours Limit      | Overtime Classification                                                               |
| :----------------------------- | :------------------------ | :------------------------------------------------------------------------------------ |
| **Normal Weekday** (Mon – Fri) | 8.0 Hours                 | Hours beyond 8.0h counted as 1.5x Overtime.                                           |
| **Saturday**                   | 6.0 Hours (07:00 – 13:00) | Hours beyond 6.0h counted as Overtime.                                                |
| **Sunday**                     | 0.0 Hours Cap             | **100% All Hours** classified as Double-Time Overtime.                                |
| **Poya & Public Holidays**     | 0.0 Hours Cap             | **100% All Hours** classified as Holiday Overtime.                                    |
| **Site Shutdown**              | Varies by actual day      | Indicator for non-working site days; emergency workers paid as per day-of-week rules. |

---

## 📈 ERP Integration & Reporting

The system provides multiple head-office reporting tools:

1. **SAP/ERP Daily Labor Upload**:
   - Matches official MAGA ERP CSV format (`Activity Code`, `Employee ID`, `Date`, `Normal Hours`, `OT Hours`, `Cost Center`).
2. **Plant Machinery & Fuel ERP Upload**:
   - Detailed machine utilization log, equipment idle vs breakdown analysis, and diesel fuel tracking.
3. **Labor Running Chart**:
   - Visual matrix showing daily supervisor gangs and worker allocation consistency across any date window.
4. **Interactive Dashboard**:
   - Real-time KPI trackers showing unassigned workers, submitted sheets, and live hours by project activity codes.

---

## 📄 License

This software is proprietary and confidential. Developed for **MAGA Engineering (Pvt) Ltd**. Unauthorized copying, modification, distribution, or deployment of this software is strictly prohibited.
