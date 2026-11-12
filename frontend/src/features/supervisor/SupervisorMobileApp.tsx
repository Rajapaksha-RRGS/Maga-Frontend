import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  supervisorStorage, 
  DayLockedError,
  type LaborerEntry, 
  type OperatorEntry, 
  type EquipmentLogEntry, 
  type SiteProject,
  type SupervisorDayStatus
} from './services/supervisorStorageService';

// Layout & Components
import { SupervisorTopBar } from './components/SupervisorTopBar';
import { SupervisorDrawer } from './components/SupervisorDrawer';
import { SupervisorSubHeader } from './components/SupervisorSubHeader';
import { SupervisorBottomNav, type SupervisorTabKey } from './components/SupervisorBottomNav';
import { SupervisorNotificationModal } from './components/SupervisorNotificationModal';
import { fetchSupervisorReminders, type CalendarEvent } from '../calendar/services/calendarEventService';
import { 
  initializeNotifications, 
  notifyNewAdminEvents 
} from '../../services/localNotificationService';
import { initPushNotifications } from '../../services/pushNotificationService';

// 5 Dedicated Tab Views
import { SupervisorDashboardView } from './views/SupervisorDashboardView';
import { LaborEntryView } from './views/LaborEntryView';
import { OperatorEntryView } from './views/OperatorEntryView';
import { EquipmentLogsView } from './views/EquipmentLogsView';
import { DailySummaryView } from './views/DailySummaryView';

import { getTodayLocalDateString } from '../../utils/dateUtils';

export default function SupervisorMobileApp() {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<SupervisorTabKey>('dashboard');
  const [currentSite, setCurrentSite] = useState<SiteProject>(() => supervisorStorage.getActiveSite());
  const [availableSites, setAvailableSites] = useState<SiteProject[]>(() => supervisorStorage.getAvailableSites());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayLocalDateString());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sync state
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Admin Reminders & Notifications state
  const [reminders, setReminders] = useState<CalendarEvent[]>([]);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [readReminderIds, setReadReminderIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('maga_supervisor_read_reminders');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Data state per selected date
  const [laborers, setLaborers] = useState<LaborerEntry[]>([]);
  const [operators, setOperators] = useState<OperatorEntry[]>([]);
  const [equipment, setEquipment] = useState<EquipmentLogEntry[]>([]);
  const [isDayLocked, setIsDayLocked] = useState(false);
  const [dayStatus, setDayStatus] = useState<SupervisorDayStatus>({
    status: 'draft',
    isLocked: false,
    submittedAt: null,
    approvedAt: null,
    remarks: null,
  });

  // Live debounced auto-save refs (Single Source of Truth)
  const laborSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operatorSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipmentSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInFlightSaveRef = useRef<boolean>(false);
  const isCheckingServerRef = useRef<boolean>(false);
  const lastSyncVersionRef = useRef<string | null>(null);
  const lastIsLockedRef = useRef<boolean>(false);
  const lastStatusRef = useRef<SupervisorDayStatus['status']>('draft');
  const [statusToast, setStatusToast] = useState<{ type: 'returned' | 'approved' | 'info'; message: string } | null>(null);
  const statusToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatusToast = (type: 'returned' | 'approved' | 'info', message: string) => {
    setStatusToast({ type, message });
    if (statusToastTimerRef.current) clearTimeout(statusToastTimerRef.current);
    statusToastTimerRef.current = setTimeout(() => setStatusToast(null), 6000);
  };

  const hasPendingLocalEdits = () =>
    Boolean(
      laborSaveTimeoutRef.current ||
        operatorSaveTimeoutRef.current ||
        equipmentSaveTimeoutRef.current ||
        isInFlightSaveRef.current
    );

  useEffect(() => {
    return () => {
      if (laborSaveTimeoutRef.current) clearTimeout(laborSaveTimeoutRef.current);
      if (operatorSaveTimeoutRef.current) clearTimeout(operatorSaveTimeoutRef.current);
      if (equipmentSaveTimeoutRef.current) clearTimeout(equipmentSaveTimeoutRef.current);
      if (statusToastTimerRef.current) clearTimeout(statusToastTimerRef.current);
    };
  }, []);

  // Load supervisor active site on mount or when user changes
  useEffect(() => {
    supervisorStorage.fetchActiveSite(user?.id, (user as any)?.tenantId)
      .then((site) => {
        if (site) {
          setCurrentSite(site);
          setAvailableSites(supervisorStorage.getAvailableSites());
        }
      })
      .catch((err) => console.warn('Could not fetch active site for supervisor:', err));
  }, [user?.id, (user as any)?.tenantId]);

  // Load data whenever selectedDate changes (Direct from Backend - Single Source of Truth)
  useEffect(() => {
    if (!user?.id) return;

    // Reset view states while fetching fresh records from Database
    let isCancelled = false;
    lastSyncVersionRef.current = null;

    Promise.all([
      supervisorStorage.fetchDayStatus(user.id, selectedDate),
      supervisorStorage.getAssignedEmployees(user.id, selectedDate),
      supervisorStorage.fetchOperators(user.id, selectedDate),
      supervisorStorage.fetchEquipment(user.id, selectedDate),
      fetchSupervisorReminders(user.id, selectedDate).catch(() => []),
    ]).then(([freshStatus, freshLaborers, freshOperators, freshEquipment, freshReminders]) => {
      if (isCancelled) return;
      if (!freshStatus.isFallback) {
        setDayStatus(freshStatus);
        setIsDayLocked(freshStatus.isLocked);
        lastIsLockedRef.current = freshStatus.isLocked;
        lastStatusRef.current = freshStatus.status;
        lastSyncVersionRef.current = freshStatus.syncVersion ?? null;
      }
      setLaborers(freshLaborers);
      setOperators(freshOperators);
      setEquipment(freshEquipment);
      setReminders(freshReminders);
      setPendingSyncCount(0);
      notifyNewAdminEvents(freshReminders, () => {
        setNotificationsModalOpen(true);
      });
    }).catch((err) => {
      if (!isCancelled) {
        console.warn('Error loading shift data from backend:', err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedDate, user?.id]);

  // Initialize native local & push notifications channel (manual refresh only — no background polling)
  useEffect(() => {
    if (!user?.id) return;

    initializeNotifications();
    initPushNotifications({
      onToken: (token) => {
        console.log('FCM Token ready:', token);
      },
      onNotificationReceived: () => {
        // Refresh reminders when push arrives in foreground
        fetchSupervisorReminders(user.id, selectedDate)
          .then((latest) => setReminders(latest))
          .catch(() => {});
      },
      onNotificationActionPerformed: () => {
        setNotificationsModalOpen(true);
      },
    });
  }, [user?.id, selectedDate]);

  const handleMarkReminderAsRead = (id: string) => {
    setReadReminderIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      try {
        localStorage.setItem('maga_supervisor_read_reminders', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const handleMarkAllRemindersAsRead = () => {
    setReadReminderIds((prev) => {
      const updated = new Set(prev);
      reminders.forEach((r) => updated.add(r.id));
      try {
        localStorage.setItem('maga_supervisor_read_reminders', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const refreshDayLockAndData = async (supId: string, date: string, reloadRecords: boolean = false) => {
    if (isCheckingServerRef.current && !reloadRecords) return null;
    isCheckingServerRef.current = true;
    try {
      const freshStatus = await supervisorStorage.fetchDayStatus(supId, date);
      if (freshStatus.isFallback) {
        return null;
      }

      const wasLocked = lastIsLockedRef.current;
      const prevStatus = lastStatusRef.current;
      const syncChanged =
        lastSyncVersionRef.current !== null &&
        freshStatus.syncVersion !== undefined &&
        freshStatus.syncVersion !== lastSyncVersionRef.current;

      lastIsLockedRef.current = freshStatus.isLocked;
      lastStatusRef.current = freshStatus.status;
      lastSyncVersionRef.current = freshStatus.syncVersion ?? null;

      setDayStatus(freshStatus);
      setIsDayLocked(freshStatus.isLocked);

      const lockTransition = wasLocked !== freshStatus.isLocked;
      const statusTransition = prevStatus !== freshStatus.status;

      if (wasLocked && !freshStatus.isLocked) {
        showStatusToast(
          'returned',
          freshStatus.remarks || 'Sheet returned by Admin — unlocked for editing.'
        );
      } else if (statusTransition && freshStatus.status === 'approved') {
        showStatusToast('approved', 'Daily sheet has been approved by Management.');
      }

      const shouldReload =
        reloadRecords ||
        lockTransition ||
        (syncChanged && !hasPendingLocalEdits());

      if (shouldReload) {
        const [freshLaborers, freshOperators, freshEquipment] = await Promise.all([
          supervisorStorage.getAssignedEmployees(supId, date),
          supervisorStorage.fetchOperators(supId, date),
          supervisorStorage.fetchEquipment(supId, date),
        ]);
        // Guard against overwriting edits started while fetch was in-flight
        if (reloadRecords || lockTransition || !hasPendingLocalEdits()) {
          setLaborers(freshLaborers);
          setOperators(freshOperators);
          setEquipment(freshEquipment);
          if (syncChanged && !lockTransition && !reloadRecords) {
            showStatusToast('info', 'Shift data updated from server.');
          }
        }
      }
      return freshStatus;
    } finally {
      isCheckingServerRef.current = false;
    }
  };

  const handleManualRefresh = async () => {
    if (!user?.id) return;
    setIsSyncing(true);
    try {
      const prevLocked = lastIsLockedRef.current;
      const prevStatus = lastStatusRef.current;
      const pendingEdits = hasPendingLocalEdits();
      const fresh = await refreshDayLockAndData(user.id, selectedDate, !pendingEdits);
      const latestReminders = await fetchSupervisorReminders(user.id, selectedDate).catch(() => null);
      if (latestReminders) setReminders(latestReminders);

      if (fresh) {
        const unlockedOrApproved =
          (prevLocked && !fresh.isLocked) ||
          (prevStatus !== fresh.status && fresh.status === 'approved');
        if (!unlockedOrApproved) {
          showStatusToast(
            'info',
            pendingEdits
              ? 'Server status checked — tap Sync to push pending local drafts.'
              : 'Refreshed from server.'
          );
        }
      }
    } catch (err) {
      console.warn('Manual refresh failed:', err);
      showStatusToast('info', 'Could not reach server. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Site change
  const handleSelectSite = (site: SiteProject) => {
    setCurrentSite(site);
    supervisorStorage.setActiveSite(site);
  };

  const refreshSyncVersionAfterLocalSave = async (supId: string, date: string) => {
    try {
      const freshStatus = await supervisorStorage.fetchDayStatus(supId, date);
      if (!freshStatus.isFallback) {
        lastIsLockedRef.current = freshStatus.isLocked;
        lastStatusRef.current = freshStatus.status;
        lastSyncVersionRef.current = freshStatus.syncVersion ?? null;
      }
    } catch {
      // ignore
    }
  };

  // Sync trigger to backend
  const handleSync = async () => {
    if (!user?.id || isDayLocked) return;
    setIsSyncing(true);
    isInFlightSaveRef.current = true;
    try {
      if (laborSaveTimeoutRef.current) { clearTimeout(laborSaveTimeoutRef.current); laborSaveTimeoutRef.current = null; }
      if (operatorSaveTimeoutRef.current) { clearTimeout(operatorSaveTimeoutRef.current); operatorSaveTimeoutRef.current = null; }
      if (equipmentSaveTimeoutRef.current) { clearTimeout(equipmentSaveTimeoutRef.current); equipmentSaveTimeoutRef.current = null; }

      await supervisorStorage.syncToBackend(user.id, selectedDate, laborers, operators, equipment);
      
      // Re-fetch fresh state directly from backend to guarantee synchronization
      await refreshDayLockAndData(user.id, selectedDate, true);
      setPendingSyncCount(0);
    } catch (err: any) {
      if (err instanceof DayLockedError) {
        await refreshDayLockAndData(user.id, selectedDate, true).catch(() => {});
        setPendingSyncCount(0);
        alert(err.message);
      } else {
        console.error('Sync failed:', err);
      }
    } finally {
      isInFlightSaveRef.current = false;
      setIsSyncing(false);
    }
  };

  const handleLockedSyncRejection = async (message: string) => {
    setPendingSyncCount(0);
    if (user?.id) {
      await refreshDayLockAndData(user.id, selectedDate, true).catch(() => {});
    }
    alert(message);
  };

  // Live Auto-Save Data update handlers (Debounced to Backend API)
  const handleSaveLaborers = (updated: LaborerEntry[]) => {
    if (isDayLocked) return;
    setLaborers(updated);
    if (!user?.id) return;
    const supId = user.id;
    setPendingSyncCount(1);
    if (laborSaveTimeoutRef.current) clearTimeout(laborSaveTimeoutRef.current);
    laborSaveTimeoutRef.current = setTimeout(async () => {
      laborSaveTimeoutRef.current = null;
      isInFlightSaveRef.current = true;
      try {
        await supervisorStorage.syncLaborersToBackend(supId, selectedDate, updated);
        setPendingSyncCount(0);
        await refreshSyncVersionAfterLocalSave(supId, selectedDate);
      } catch (err: any) {
        if (err instanceof DayLockedError) {
          await handleLockedSyncRejection(err.message);
        } else {
          console.warn('Auto-save laborers error:', err);
        }
      } finally {
        isInFlightSaveRef.current = false;
      }
    }, 800);
  };

  const handleSaveOperators = (updated: OperatorEntry[]) => {
    if (isDayLocked) return;
    setOperators(updated);
    if (!user?.id) return;
    const supId = user.id;
    setPendingSyncCount(1);
    if (operatorSaveTimeoutRef.current) clearTimeout(operatorSaveTimeoutRef.current);
    operatorSaveTimeoutRef.current = setTimeout(async () => {
      operatorSaveTimeoutRef.current = null;
      isInFlightSaveRef.current = true;
      try {
        await supervisorStorage.syncOperatorsToBackend(supId, selectedDate, updated);
        setPendingSyncCount(0);
        await refreshSyncVersionAfterLocalSave(supId, selectedDate);
      } catch (err: any) {
        if (err instanceof DayLockedError) {
          await handleLockedSyncRejection(err.message);
        } else {
          console.warn('Auto-save operators error:', err);
        }
      } finally {
        isInFlightSaveRef.current = false;
      }
    }, 800);
  };

  const handleSaveEquipment = (updated: EquipmentLogEntry[]) => {
    if (isDayLocked) return;
    setEquipment(updated);
    if (!user?.id) return;
    const supId = user.id;
    setPendingSyncCount(1);
    if (equipmentSaveTimeoutRef.current) clearTimeout(equipmentSaveTimeoutRef.current);
    equipmentSaveTimeoutRef.current = setTimeout(async () => {
      equipmentSaveTimeoutRef.current = null;
      isInFlightSaveRef.current = true;
      try {
        await supervisorStorage.syncEquipmentToBackend(supId, selectedDate, updated);
        setPendingSyncCount(0);
        await refreshSyncVersionAfterLocalSave(supId, selectedDate);
      } catch (err: any) {
        if (err instanceof DayLockedError) {
          await handleLockedSyncRejection(err.message);
        } else {
          console.warn('Auto-save equipment error:', err);
        }
      } finally {
        isInFlightSaveRef.current = false;
      }
    }, 800);
  };

  const handleLockDay = async () => {
    if (!user?.id) return;
    isInFlightSaveRef.current = true;
    try {
      if (laborSaveTimeoutRef.current) { clearTimeout(laborSaveTimeoutRef.current); laborSaveTimeoutRef.current = null; }
      if (operatorSaveTimeoutRef.current) { clearTimeout(operatorSaveTimeoutRef.current); operatorSaveTimeoutRef.current = null; }
      if (equipmentSaveTimeoutRef.current) { clearTimeout(equipmentSaveTimeoutRef.current); equipmentSaveTimeoutRef.current = null; }

      const result = await supervisorStorage.submitDayToBackend(user.id, selectedDate, laborers, operators, equipment);
      if (result.status && result.isLocked !== undefined) {
        setDayStatus({
          status: result.status,
          isLocked: result.isLocked,
          submittedAt: result.submittedAt,
          remarks: null,
        });
        setIsDayLocked(result.isLocked);
        lastIsLockedRef.current = result.isLocked;
        lastStatusRef.current = result.status;
        await refreshSyncVersionAfterLocalSave(user.id, selectedDate);
      } else {
        const freshStatus = await supervisorStorage.fetchDayStatus(user.id, selectedDate);
        if (!freshStatus.isFallback) {
          setDayStatus(freshStatus);
          setIsDayLocked(freshStatus.isLocked);
          lastIsLockedRef.current = freshStatus.isLocked;
          lastStatusRef.current = freshStatus.status;
          lastSyncVersionRef.current = freshStatus.syncVersion ?? null;
        }
      }
      setPendingSyncCount(0);
      if (result.offline && result.message) {
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit and lock day on backend');
      throw err;
    } finally {
      isInFlightSaveRef.current = false;
    }
  };

  // Compute badge counts for Bottom Nav (checks all unit modalities)
  const isEquipmentLogged = (e: EquipmentLogEntry): boolean => {
    if (e.status === 'done') return true;
    if ((Number(e.daysValue) || 0) > 0) return true;
    if ((Number(e.hoursValue) || 0) > 0) return true;
    if ((Number(e.extraHoursValue) || 0) > 0) return true;
    if ((Number(e.areaValue) || 0) > 0) return true;
    if ((Number(e.totalMileage) || 0) > 0) return true;
    if ((Number(e.netHours) || 0) > 0) return true;
    if ((Number(e.workingHours) || 0) > 0) return true;
    if (Number(e.endMeter) > 0 && Number(e.endMeter) > Number(e.startMeter)) return true;
    if (e.activitySplits && e.activitySplits.some((s) => Number(s.utilization) > 0)) return true;
    return false;
  };

  const laborPendingCount = (laborers || []).filter((l) => !l.inTime || !l.outTime).length;
  // Operator is incomplete only if inTime or outTime is missing.
  // No machine assignment is valid — auto-balanced to ZXQOPRIDLE on sync.
  const operatorPendingCount = (operators || []).filter((o) => !o.inTime || !o.outTime).length;
  const equipmentPendingCount = (equipment || []).filter((e) => !isEquipmentLogged(e)).length;

  const supervisorDisplayName = user?.fullName || 'Supervisor';
  const unreadNotificationsCount = reminders.filter((r) => !readReminderIds.has(r.id)).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <SupervisorTopBar
        currentSite={currentSite}
        onSelectSite={handleSelectSite}
        pendingSyncCount={pendingSyncCount}
        onSync={handleSync}
        onRefresh={handleManualRefresh}
        isSyncing={isSyncing}
        onOpenDrawer={() => setDrawerOpen(true)}
        isDayLocked={isDayLocked}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setNotificationsModalOpen(true)}
      />

      {/* ── Live Status Change Toast ─────────────────────────────────────────── */}
      {statusToast && (
        <div
          className={`mx-auto mt-2 w-[calc(100%-1.5rem)] max-w-md px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-md border flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 ${
            statusToast.type === 'returned'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
              : statusToast.type === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
              : 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100'
          }`}
        >
          <span>{statusToast.message}</span>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-[11px] font-bold opacity-70 hover:opacity-100 px-1.5 py-0.5 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Slide Drawer ────────────────────────────────────────────────────── */}
      <SupervisorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pendingSyncCount={pendingSyncCount}
        onSync={handleSync}
        isSyncing={isSyncing}
        currentSite={currentSite}
        availableSites={availableSites}
        onSelectSite={handleSelectSite}
      />

      {/* ── Sub-Header (Date Stepper & Contextual Action) ──────────────────── */}
      <SupervisorSubHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      {/* ── Main Viewport Content ────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-md mx-auto px-3.5 pt-3">
        {activeTab === 'dashboard' && (
          <SupervisorDashboardView
            supervisorName={supervisorDisplayName}
            currentSite={currentSite}
            laborers={laborers}
            operators={operators}
            equipment={equipment}
            pendingSyncCount={pendingSyncCount}
            isDayLocked={isDayLocked}
            dayStatus={dayStatus.status}
            adminRemarks={dayStatus.remarks}
            reminders={reminders}
            onOpenNotifications={() => setNotificationsModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onQuickSync={handleSync}
            onRefresh={handleManualRefresh}
            isRefreshing={isSyncing}
          />
        )}

        {activeTab === 'labor' && (
          <LaborEntryView
            laborers={laborers}
            onSaveLaborers={handleSaveLaborers}
            isDayLocked={isDayLocked}
            selectedDate={selectedDate}
            projectId={currentSite.id}
            supervisorId={user?.id}
          />
        )}

        {activeTab === 'operators' && (
          <OperatorEntryView
            operators={operators}
            equipment={equipment}
            onSaveOperators={handleSaveOperators}
            onSaveEquipment={handleSaveEquipment}
            isDayLocked={isDayLocked}
            selectedDate={selectedDate}
            projectId={currentSite.id}
            supervisorId={user?.id}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentLogsView
            equipment={equipment}
            operators={operators}
            onSaveEquipment={handleSaveEquipment}
            isDayLocked={isDayLocked}
            selectedDate={selectedDate}
            projectId={currentSite.id}
            supervisorId={user?.id}
          />
        )}

        {activeTab === 'summary' && (
          <DailySummaryView
            supervisorName={supervisorDisplayName}
            currentSite={currentSite}
            selectedDate={selectedDate}
            laborers={laborers}
            operators={operators}
            equipment={equipment}
            isDayLocked={isDayLocked}
            dayStatus={dayStatus.status}
            adminRemarks={dayStatus.remarks}
            onLockDay={handleLockDay}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* ── Bottom Navigation Bar (5 Tabs) ──────────────────────────────────── */}
      <SupervisorBottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        badgeCounts={{
          laborPending: laborPendingCount,
          operatorPending: operatorPendingCount,
          equipmentPending: equipmentPendingCount,
        }}
      />

      {/* ── Admin Reminders & Notifications Modal ───────────────────────── */}
      <SupervisorNotificationModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        reminders={reminders}
        selectedDate={selectedDate}
        readReminderIds={readReminderIds}
        onMarkAsRead={handleMarkReminderAsRead}
        onMarkAllAsRead={handleMarkAllRemindersAsRead}
      />
    </div>
  );
}
