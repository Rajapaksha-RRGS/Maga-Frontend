/**
 * App.tsx
 *
 * Root router. Sets up all application routes with role-based protection.
 *
 * Route structure:
 *   /login              → LoginPage            (public)
 *   /admin/*            → AdminLayout          (protected, role=admin)
 *     /admin            → AdminDashboardPage
 *     /admin/employees  → EmployeesPage
 *     /admin/equipment  → EquipmentPage
 *     /admin/activity-codes → ActivityCodesPage
 *     /admin/supervisors    → SupervisorsPage
 *     /admin/calendar       → CalendarPage
 *     /admin/assignments    → AssignmentsPage
 *     /admin/reports        → ReportsPage
 *   /supervisor         → SupervisorLayout     (protected, role=supervisor)
 *     index             → SupervisorFlowPage (4-step daily flow)
 *   *                   → redirect to /login
 *
 * Note: the existing SupervisorFlowPage.tsx is preserved in src/ — it will be
 * integrated under SupervisorLayout in Master Prompt 3.
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";

// Auth
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import LoginPage from './features/auth/pages/LoginPage';

// Layouts
import AdminLayout from './layout/AdminLayout';
import SupervisorLayout from './layout/SupervisorLayout';

//usertable 
import UseTable from './components/user';

// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EquipmentPage from './pages/EquipmentPage';
import ActivityCodesPage from './pages/ActivityCodesPage';
import SupervisorsPage from './pages/SupervisorsPage';
import CalendarPage from './pages/CalendarPage';
import AssignmentsPage from './pages/AssignmentsPage';
import ReportsPage from './pages/ReportsPage';

// Supervisor flow
import SupervisorFlowPage from './SupervisorFlowPage';

// Splash Screen & Showcase
import SplashScreen from './components/SplashScreen';
import SplashShowcasePage from './pages/SplashShowcasePage';

export default function App() {
  const [showInitialSplash, setShowInitialSplash] = useState(true);

  useEffect(() => {
    // Show startup splash screen for 1.6s on initial app load
    const timer = setTimeout(() => {
      setShowInitialSplash(false);
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  if (showInitialSplash) {
    return (
      <SplashScreen
        theme="light"
        indicatorType="dots"
        showSubtitle={true}
      />
    );
  }

  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        {/* ── Public ─────────────────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/splash" element={<SplashShowcasePage />} />
        <Route path="/users" element={<UseTable />} />

        {/* ── Admin (protected, role=admin) ───────────────────────────────── */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="employees"     element={<EmployeesPage />} />
            <Route path="equipment"     element={<EquipmentPage />} />
            <Route path="activity-codes" element={<ActivityCodesPage />} />
            <Route path="supervisors"   element={<SupervisorsPage />} />
            <Route path="calendar"      element={<CalendarPage />} />
            <Route path="assignments"   element={<AssignmentsPage />} />
            <Route path="reports"       element={<ReportsPage />} />
          </Route>
        </Route>

        {/* ── Supervisor (protected, role=supervisor) ─────────────────────── */}
        <Route element={<ProtectedRoute requiredRole="supervisor" />}>
          <Route path="/supervisor" element={<SupervisorLayout />}>
            <Route index element={<SupervisorFlowPage />} />
          </Route>
        </Route>

        {/* ── Fallback: everything else → /login ─────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
