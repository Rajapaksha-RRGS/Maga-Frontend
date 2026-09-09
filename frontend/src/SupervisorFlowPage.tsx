import { useState, useEffect } from 'react';
import { SupervisorDashboardPage } from './pages/SupervisorDashboardPage';
import { CheckInPage } from './pages/CheckInPage';
import { ActivityDistributionPage } from './pages/ActivityDistributionPage';
import { CheckoutSubmitPage } from './pages/CheckoutSubmitPage';
import { useAssignedEmployees } from './features/time-entries/hooks/useAssignedEmployees';
import { useTimeEntry } from './features/time-entries/hooks/useTimeEntry';
import { getActivityCodes } from './features/time-entries/services/timeEntryService';
import type { ActivityCode } from './features/time-entries/services/timeEntryService';
import { getEffectiveDayTypeForDate } from './features/calendar/services/calendarService';
import type { DayType } from './features/calendar/services/calendarService';
import { useAuth } from './context/AuthContext';
import { SplashScreen } from './components/SplashScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'dashboard' | 'checkin' | 'checkout' | 'activity';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── SupervisorFlowPage ───────────────────────────────────────────────────────

/**
 * SupervisorFlowPage — single-route container for the daily flow.
 *
 * Flow (Method 1 - Construction End-of-Day Hour Distribution):
 *  1. Dashboard -> Start Check-in
 *  2. Check-in (In-time 07:00 recorded)
 *  3. Check-out (Out-time 17:30 recorded -> established total shift duration)
 *  4. Activities & OT (Split total hours across multiple site tasks + auto OT calculation)
 *
 * URL stays on /supervisor throughout the entire flow.
 */
export default function SupervisorFlowPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('dashboard');
  const [activityCodes, setActivityCodes] = useState<ActivityCode[]>([]);
  const [dayType, setDayType] = useState<DayType | undefined>(undefined);

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
    setEmployeeActivities,
    bulkSetActivities,
    setOutTime,
    submitDay,
    checkedInCount,
  } = useTimeEntry(employees.map((e) => e.id), supervisorId);

  useEffect(() => {
    if (!tenantId) return;
    getActivityCodes(tenantId)
      .then(setActivityCodes)
      .catch(console.error);
  }, [tenantId]);

  useEffect(() => {
    getEffectiveDayTypeForDate(today)
      .then(setDayType)
      .catch(console.error);
  }, [today]);

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
          onNext={() => go('checkout')}
        />
      );

    case 'checkout':
      return (
        <CheckoutSubmitPage
          employees={employees}
          entries={entries}
          submitStatus={submitStatus}
          date={today}
          dayType={dayType}
          onOutTimeChange={setOutTime}
          onNext={() => go('activity')}
          onBack={() => go('checkin')}
        />
      );

    case 'activity':
      return (
        <ActivityDistributionPage
          employees={employees}
          activityCodes={activityCodes}
          entries={entries}
          date={today}
          dayType={dayType}
          submitStatus={submitStatus}
          onUpdateActivities={setEmployeeActivities}
          onBulkUpdateActivities={bulkSetActivities}
          onSubmit={handleSubmit}
          onBack={() => go('checkout')}
        />
      );
  }
}
