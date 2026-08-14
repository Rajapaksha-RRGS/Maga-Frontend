import { useState, useEffect } from 'react';
import { SupervisorDashboardPage } from './pages/SupervisorDashboardPage';
import { CheckInPage }             from './pages/CheckInPage';
import { ActivityAssignPage }      from './pages/ActivityAssignPage';
import { CheckoutSubmitPage }      from './pages/CheckoutSubmitPage';
import { useAssignedEmployees }    from './features/time-entries/hooks/useAssignedEmployees';
import { useTimeEntry }            from './features/time-entries/hooks/useTimeEntry';
import { getActivityCodes }        from './features/time-entries/services/timeEntryService';
import type { ActivityCode }       from './features/time-entries/services/timeEntryService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'dashboard' | 'checkin' | 'activity' | 'checkout';

// Mock supervisor session (replace with real AuthContext once auth module is built)
const MOCK_SUPERVISOR = {
  id: 'sup-mock-001',
  name: 'Gayan',
  tenantId: 'tenant-mock-001',
};

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── SupervisorFlowPage ───────────────────────────────────────────────────────

/**
 * SupervisorFlowPage — single-route container for the 4-screen daily flow.
 *
 * Manages:
 *  - currentStep state (no route transitions — instant step switches)
 *  - Passes employee data and time-entry callbacks down to each page
 *
 * URL stays on /supervisor throughout the entire flow.
 */
export default function SupervisorFlowPage() {
  const [step, setStep] = useState<Step>('dashboard');
  const [activityCodes, setActivityCodes] = useState<ActivityCode[]>([]);

  const today = todayISO();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    employees,
    loading: empLoading,
  } = useAssignedEmployees(MOCK_SUPERVISOR.id, today);

  const {
    entries,
    submitStatus,
    checkIn,
    setActivity,
    setOutTime,
    submitDay,
    checkedInCount,
  } = useTimeEntry(employees.map((e) => e.id));

  useEffect(() => {
    getActivityCodes(MOCK_SUPERVISOR.tenantId)
      .then(setActivityCodes)
      .catch(console.error);
  }, []);

  // ── Step navigation ────────────────────────────────────────────────────────
  const go = (s: Step) => setStep(s);

  function handleSubmit() {
    submitDay(MOCK_SUPERVISOR.id, today);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (empLoading && step === 'dashboard') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  // ── Step rendering ─────────────────────────────────────────────────────────
  switch (step) {
    case 'dashboard':
      return (
        <SupervisorDashboardPage
          supervisorName={MOCK_SUPERVISOR.name}
          employees={employees}
          checkedInCount={checkedInCount}
          onStartCheckin={() => go('checkin')}
        />
      );

    case 'checkin':
      return (
        <CheckInPage
          employees={employees}
          entries={entries}
          onCheckIn={checkIn}
          onBack={() => go('dashboard')}
          onNext={() => go('activity')}
        />
      );

    case 'activity':
      return (
        <ActivityAssignPage
          employees={employees}
          activityCodes={activityCodes}
          onSetActivity={setActivity}
          onBack={() => go('checkin')}
          onNext={() => go('checkout')}
        />
      );

    case 'checkout':
      return (
        <CheckoutSubmitPage
          employees={employees}
          entries={entries}
          submitStatus={submitStatus}
          onOutTimeChange={setOutTime}
          onSubmit={handleSubmit}
          onBack={() => go('activity')}
        />
      );
  }
}
