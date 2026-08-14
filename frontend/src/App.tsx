import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SupervisorFlowPage from './SupervisorFlowPage';

/**
 * App root — sets up routing.
 * Current routes:
 *   /supervisor  →  SupervisorFlowPage (4-screen daily time-entry flow)
 *
 * Add further routes here as other modules are built:
 *   /login       →  LoginPage
 *   /admin/*     →  Admin module pages
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Supervisor daily flow — single route, step state managed internally */}
        <Route path="/supervisor" element={<SupervisorFlowPage />} />

        {/* Default: redirect to supervisor flow (remove once login is built) */}
        <Route path="*" element={<Navigate to="/supervisor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
