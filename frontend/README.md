# MäGA Labour Entry & Site Management System

<div align="center">
  <img src="frontend/src/assets/maga-logo-47321F1221-seeklogo.com.png" alt="MäGA Engineering Logo" width="160" />
  <p><strong>Enterprise Multi-Tenant SaaS for Construction Labour Tracking, Field Attendance & Reporting</strong></p>

  [![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Status](https://img.shields.io/badge/Build-Passing-emerald)](https://github.com/)
  [![Environment](https://img.shields.io/badge/Environment-Production_Ready-blue)](#)
</div>

---

## 📌 Executive Summary

The **MäGA Labour Entry & Attendance System** is an enterprise-grade web application designed to replace manual paper logs and legacy Excel spreadsheet workflows on construction and infrastructure sites. 

Built with a **Multi-Tenant SaaS architecture**, it provides isolated tenant spaces for multiple business entities while maintaining a shared, high-performance codebase. It pairs a **Desktop-First Admin Command Portal** with a **Mobile-First Supervisor Step Flow** engineered specifically for rugged field environments.

---

## 🚀 Key Modules & Workflows

### 1. 🛡️ Admin Portal (Desktop-First)
- **Fixed Full-Viewport Layout (`h-screen`)**: Navigation remains static while page content scrolls smoothly.
- **Corporate Branding**: Modern Deep Ocean Blue (`#091D36`) and MäGA Emerald Green design theme.
- **Master Data Management (CRUD)**:
  - **Employees**: Business partner categorization, Trade Groups, NIC numbers, activation/deactivation.
  - **Equipment**: Heavy machinery and construction tooling inventory with active status filters.
  - **Activity Codes**: Real-time uniqueness validation with standardized coding (e.g., `EW-01`).
  - **Supervisors**: User account creation, auto-generated secure temporary passwords, employee linking.
  - **Calendar**: Tenant-specific holiday calendar, normal days, Sundays, Poyas, and multiplier day-types.
- **Daily Assignments**: Assign supervisors to specific teams and projects daily.
- **Consolidated Reporting**: Date-range filtering, shift summaries, overtime auditing, and payroll-ready exports.

### 2. 👷 Supervisor Flow (Mobile-First Step Flow)
- **Step 1: Daily Dashboard**: Overview of assigned workforce, check-in status, and shift progress.
- **Step 2: Check-In & Attendance**: Fast batch check-in, late arrival timestamps, and absence logging.
- **Step 3: Activity & Hours Allocation**: Distribute working hours across activity codes with live overtime tracking.
- **Step 4: Checkout & Shift Locking**: Summary review, remark annotations, and one-click submission locking to prevent tampering.

### 3. 🎨 SlidePanel & Form System
- **Theme-Integrated SlidePanel**: Slide-in overlay drawer with adaptive styling for child forms, inputs, and interactive lists.
- **Full Keyboard Accessibility**: Escape key listener, focus trapping, and backdrop dismiss.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Core Framework** | React 19 + TypeScript | Component-driven architecture with strict type safety |
| **Bundler & Build Tool** | Vite 8 | Fast HMR, lightning-fast ES module build pipeline |
| **Styling & Theme** | Tailwind CSS + PostCSS | Custom corporate tokens, responsive utilities, dynamic CSS cascade |
| **Icons** | Lucide React | Lightweight, accessible SVG icon library |
| **Routing** | React Router v7 | Nested layout routing, route guards & role-based access control (RBAC) |
| **HTTP Client** | Axios | Configured with base URLs, interceptors, and error handling |
| **Authentication** | JWT (JSON Web Tokens) | Secure session persistence and multi-tenant authentication |

---

## 📂 Project Architecture

```plaintext
Maga-Frontend/
└── frontend/
    ├── public/                      # Static assets served directly
    ├── src/
    │   ├── assets/                  # Brand assets (MäGA Logo, Hero banners)
    │   ├── components/              # Shared UI components
    │   │   ├── SlidePanel.tsx       # Slide-in modal panel (Navy & Blue theme)
    │   │   ├── SplashScreen.tsx     # Animated entrance splash screen
    │   │   └── ...
    │   ├── context/                 # Application Context Providers
    │   │   └── AuthContext.tsx      # Multi-tenant Auth state & session storage
    │   ├── features/                # Domain-driven feature modules
    │   │   ├── activity-codes/      # Activity code CRUD & tables
    │   │   ├── assignments/         # Daily labour assignment engine
    │   │   ├── auth/                # Login, credentials, tenant validation
    │   │   ├── calendar/            # Calendar & holiday schedules
    │   │   ├── dashboard/           # Admin analytics & metrics
    │   │   ├── employees/           # Employee management & forms
    │   │   ├── equipment/           # Equipment tracking & forms
    │   │   ├── reports/             # Aggregated shift & payroll reporting
    │   │   └── supervisors/         # Supervisor accounts & employee links
    │   ├── layout/                  # Page shell layouts
    │   │   ├── AdminLayout.tsx      # Fixed viewport Admin layout
    │   │   └── SupervisorLayout.tsx # Mobile-optimized field layout
    │   ├── pages/                   # Application route views
    │   ├── lib/                     # Utilities & API helpers
    │   ├── App.tsx                  # Root router configuration
    │   ├── main.tsx                 # Entrypoint
    │   └── index.css                # Global Tailwind CSS & custom design tokens
    ├── .env                         # Local environment variables
    ├── .env.example                 # Environment configuration template
    ├── package.json                 # Project dependencies and npm scripts
    ├── tsconfig.json                # TypeScript compiler configuration
    └── vite.config.ts               # Vite bundler configuration
```

---

## ⚙️ Environment Variables

Create a `.env` file in `frontend/`:

```env
# API Gateway / Backend Base URL
VITE_API_BASE_URL=http://localhost:4000/api

# Application Display Name
VITE_APP_NAME="MäGA Labour Entry System"

# Environment Mode (development | staging | production)
VITE_ENV=production
```

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher (Node 20+ LTS recommended)
- **npm**: `v9.0.0` or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Rajapaksha-RRGS/Maga-Frontend.git
cd Maga-Frontend/frontend

# Install dependencies
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 🏭 Production Build & Verification

To create an optimized, minified production bundle:

```bash
cd frontend
npm run build
```

The compiled assets will be output to the `frontend/dist/` directory.

### Preview Production Build Locally
```bash
npm run preview
```

---

## 🚢 Production Deployment

### Option 1: Nginx Web Server (Recommended)

Serve the `dist/` folder using Nginx with SPA routing support:

```nginx
server {
    listen 80;
    server_name labour.maga.lk;

    root /var/www/maga-frontend/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Static assets with cache headers
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA Fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Option 2: Docker Production Deployment

#### `Dockerfile`
```dockerfile
# Stage 1: Build static bundle
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Run with Docker:
```bash
docker build -t maga-frontend:latest .
docker run -d -p 80:80 --name maga-frontend maga-frontend:latest
```

---

## 📜 Available NPM Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts Vite local development server with Hot Module Replacement (HMR) |
| `npm run build` | Runs TypeScript compilation (`tsc -b`) and bundles for production with Vite |
| `npm run preview` | Starts a local web server to preview the built `dist/` output |
| `npm run lint` | Analyzes code for quality, best practices, and ESLint rule compliance |

---

## 🔒 Security & Performance Features

- **Strict TypeScript Validation**: Full type coverage with zero `any` leaks on API contracts.
- **Role-Based Route Guards**: Immediate redirection to `/login` for unauthenticated or unauthorized users.
- **Dynamic Viewport Height (`100dvh`)**: Immune to mobile browser address bar collapse issues.
- **Optimized Asset Delivery**: Tree-shaken icons and lazy-loaded route boundaries.

---

## 📄 License & Attribution

Internal software developed for **MäGA Engineering (Pvt) Ltd**.  
All rights reserved © 2026.
