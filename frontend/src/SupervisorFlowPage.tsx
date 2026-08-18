import { useState, useEffect } from 'react';
import { SupervisorDashboardPage } from './pages/SupervisorDashboardPage';
import { CheckInPage } from './pages/CheckInPage';
import { ActivityAssignPage } from './pages/ActivityAssignPage';
import { CheckoutSubmitPage } from './pages/CheckoutSubmitPage';
import { useAssignedEmployees } from './features/time-entries/hooks/useAssignedEmployees';
import { useTimeEntry } from './features/time-entries/hooks/useTimeEntry';
import { getActivityCodes } from './features/time-entries/services/timeEntryService';
import type { ActivityCode } from './features/time-entries/services/timeEntryService';
import { useAuth } from './context/AuthContext';
import { SplashScreen } from './components/SplashScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'dashboard' | 'checkin' | 'activity' | 'checkout';

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
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('dashboard');
  const [activityCodes, setActivityCodes] = useState<ActivityCode[]>([]);

  const today = todayISO();

  // Derive supervisor context from the authenticated user.
  // useAuth guarantees `user` is non-null inside a protected route.
  const supervisorId = user?.id ?? '';
  const supervisorName = user?.fullName ?? user?.username ?? 'Supervisor';
  const tenantId = user?.tenantId ?? '';

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    employees,
    loading: empLoading,
  } = useAssignedEmployees(supervisorId, today);

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
    if (!tenantId) return;
    getActivityCodes(tenantId)
      .then(setActivityCodes)
      .catch(console.error);
  }, [tenantId]);

  // ── Step navigation ────────────────────────────────────────────────────────
  const go = (s: Step) => setStep(s);

  function handleSubmit() {
    submitDay(supervisorId, today);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (empLoading && step === 'dashboard') {
    return (
      <SplashScreen
        theme="light"
        indicatorType="dots"
        showSubtitle={true}
      />
    );
  }

  // ── Step rendering ─────────────────────────────────────────────────────────
  switch (step) {
    case 'dashboard':
      return (
        <SupervisorDashboardPage
          supervisorName={supervisorName}
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
