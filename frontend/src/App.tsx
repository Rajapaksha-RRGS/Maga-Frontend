/**
 * App.tsx
 *
 * Root router. Sets up all application routes with role-based protection.
 *
 * Route structure:
 *   /login                  → LoginPage            (public)
 *   /super-admin/*          → SuperAdminLayout     (protected, role=super_admin)
 *     /super-admin          → SADashboardPage      (Executive HQ Dashboard)
 *     /super-admin/projects → SAProjectsPage       (Projects & Site Admins)
 *     /super-admin/employees → SAEmployeesPage     (Global Employee Master)
 *     /super-admin/business-partners → SABusinessPartnersPage
 *     /super-admin/equipment → SAEquipmentPage     (Global Equipment Master)
 *     /super-admin/trade-groups → SATradeGroupsPage
 *     /super-admin/activity-codes → SAActivityCodesPage
 *     /super-admin/transfers → SATransfersPage     (Inter-project transfers)
 *     /super-admin/settings → SASettingsPage
 *   /admin/*                → AdminLayout          (protected, role=admin|super_admin)
 *     /admin                → AdminDashboardPage
 *     /admin/employees      → EmployeesPage
 *     /admin/equipment      → EquipmentPage
 *     /admin/activity-codes → ActivityCodesPage
 *     /admin/supervisors    → SupervisorsPage
 *     /admin/calendar       → CalendarPage
 *     /admin/assignments    → AssignmentsPage
 *     /admin/reports        → ReportsPage
 *   /supervisor             → SupervisorLayout     (protected, role=supervisor)
 *     index                 → SupervisorFlowPage (4-step daily flow)
 *   *                       → redirect to /login
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";

// Auth
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';

// Layouts
import AdminLayout from './layout/AdminLayout';
import SupervisorLayout from './layout/SupervisorLayout';
import SuperAdminLayout from './layout/SuperAdminLayout';

// Super Admin pages
import SADashboardPage from './pages/superadmin/SADashboardPage';
import SAProjectsPage from './pages/superadmin/SAProjectsPage';
import SAEmployeesPage from './pages/superadmin/SAEmployeesPage';
import SABusinessPartnersPage from './pages/superadmin/SABusinessPartnersPage';
import SAEquipmentPage from './pages/superadmin/SAEquipmentPage';
import SATradeGroupsPage from './pages/superadmin/SATradeGroupsPage';
import SAActivityCodesPage from './pages/superadmin/SAActivityCodesPage';
import SATransfersPage from './pages/superadmin/SATransfersPage';
import SASettingsPage from './pages/superadmin/SASettingsPage';

//usertable 
import UseTable from './components/user';

// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import BusinessPartnersPage from './pages/BusinessPartnersPage';
import EquipmentPage from './pages/EquipmentPage';
import ActivityCodesPage from './pages/ActivityCodesPage';
import SupervisorsPage from './pages/SupervisorsPage';
import CalendarPage from './pages/CalendarPage';
import AssignmentsHubPage from './pages/AssignmentsHubPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ReportsPage from './pages/ReportsPage';


// Theme
import { ThemeProvider } from './context/ThemeContext';

// Supervisor mobile app
import SupervisorMobileApp from './features/supervisor/SupervisorMobileApp';

// Splash Screen & Showcase
import SplashScreen from './components/SplashScreen';
import SplashShowcasePage from './pages/SplashShowcasePage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <SplashScreen
        theme="light"
        indicatorType="dots"
        showSubtitle={true}
      />
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Analytics />
        <ErrorBoundary>
          <Routes>
            {/* ── Public ─────────────────────────────────────────────────────── */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/splash" element={<SplashShowcasePage />} />
            <Route path="/users" element={<UseTable />} />
            {/* ── Public direct supervisor mobile preview ─────────────────────── */}
            <Route path="/labour" element={<SupervisorMobileApp />} />
            <Route path="/supervisor-preview" element={<SupervisorMobileApp />} />
          



          {/* ── Admin (protected, role=admin or super_admin) ───────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />

              {/* Legacy redirect: Projects & Admins is now exclusively in Super Admin portal */}
              <Route path="tenants" element={<Navigate to="/super-admin/projects" replace />} />

              <Route path="employees"         element={<EmployeesPage />} />
              <Route path="business-partners" element={<BusinessPartnersPage />} />
              <Route path="equipment"         element={<EquipmentPage />} />
              <Route path="activity-codes" element={<ActivityCodesPage />} />
              <Route path="supervisors"   element={<SupervisorsPage />} />
              <Route path="calendar"      element={<CalendarPage />} />
              <Route path="assignments" element={<Navigate to="/admin/assignments/labour" replace />} />
              <Route path="assignments/labour"    element={<AssignmentsHubPage defaultTab="labour" />} />
              <Route path="assignments/operator"   element={<AssignmentsHubPage defaultTab="operator" />} />
              <Route path="assignments/equipment"  element={<AssignmentsHubPage defaultTab="equipment" />} />
              <Route path="approvals"     element={<ApprovalsPage />} />
              <Route path="reports"       element={<ReportsPage />} />
            </Route>
          </Route>

          {/* ── Super Admin (protected, role=super_admin only) ──────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
            <Route path="/super-admin" element={<SuperAdminLayout />}>
              <Route index                  element={<SADashboardPage />} />
              <Route path="dashboard"       element={<SADashboardPage />} />
              <Route path="projects"        element={<SAProjectsPage />} />
              <Route path="employees"       element={<SAEmployeesPage />} />
              <Route path="business-partners" element={<SABusinessPartnersPage />} />
              <Route path="equipment"       element={<SAEquipmentPage />} />
              <Route path="trade-groups"    element={<SATradeGroupsPage />} />
              <Route path="activity-codes"  element={<SAActivityCodesPage />} />
              <Route path="transfers"       element={<SATransfersPage />} />
              <Route path="settings"        element={<SASettingsPage />} />
            </Route>
          </Route>

          {/* ── Supervisor (protected, role=supervisor, admin, super_admin) ──── */}
          <Route element={<ProtectedRoute allowedRoles={['supervisor', 'admin', 'super_admin']} />}>
            <Route path="/supervisor" element={<SupervisorLayout />}>
              <Route index element={<SupervisorMobileApp />} />
            </Route>
          </Route>


          {/* ── Fallback: everything else → /login ─────────────────────────── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </ThemeProvider>
  );
}
