import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  supervisorStorage, 
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
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => supervisorStorage.getPendingSyncCount());
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

  // Load data whenever selectedDate changes (Offline-First: cached first, then fresh backend)
  useEffect(() => {
    // 1. Instant render from local cache
    const loadedLaborers = supervisorStorage.getLaborers(selectedDate);
    const loadedOperators = supervisorStorage.getOperators(selectedDate);
    const loadedEquipment = supervisorStorage.getEquipment(selectedDate);
    const cachedStatus = supervisorStorage.getDayStatus(selectedDate);

    setLaborers(loadedLaborers);
    setOperators(loadedOperators);
    setEquipment(loadedEquipment);
    setDayStatus(cachedStatus);
    setIsDayLocked(cachedStatus.isLocked);
    setPendingSyncCount(supervisorStorage.getPendingSyncCount());

    // 2. Fetch fresh real data from backend (Admin assigned workers, entries & day status)
    if (user?.id) {
      supervisorStorage.fetchDayStatus(user.id, selectedDate)
        .then((freshStatus) => {
          setDayStatus(freshStatus);
          setIsDayLocked(freshStatus.isLocked);
        })
        .catch(() => {});

      supervisorStorage.getAssignedEmployees(user.id, selectedDate)
        .then((freshLaborers) => {
          setLaborers(freshLaborers);
          setIsDayLocked(supervisorStorage.isDayLocked(selectedDate));
        })
        .catch((err) => console.warn('Could not fetch assigned laborers:', err));

      supervisorStorage.fetchOperators(user.id, selectedDate)
        .then((freshOperators) => {
          setOperators(freshOperators);
        })
        .catch(() => {});

      supervisorStorage.fetchEquipment(user.id, selectedDate)
        .then((freshEquipment) => {
          setEquipment(freshEquipment);
        })
        .catch((err) => console.warn('Could not fetch assigned equipment:', err));

      // Fetch head office / admin reminders for this supervisor on selectedDate
      fetchSupervisorReminders(user.id, selectedDate)
        .then((freshReminders) => {
          setReminders(freshReminders);
        })
        .catch((err) => console.warn('Could not fetch supervisor reminders:', err));
    }
  }, [selectedDate, user?.id]);

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

  // Auto-flush queued offline submissions when network reconnects
  useEffect(() => {
    const handleOnline = async () => {
      if (!user?.id) return;
      try {
        const flushed = await supervisorStorage.flushQueuedSubmissions(user.id);
        if (flushed.includes(selectedDate)) {
          const fresh = await supervisorStorage.fetchDayStatus(user.id, selectedDate);
          setDayStatus(fresh);
          setIsDayLocked(fresh.isLocked);
        }
      } catch (err) {
        console.warn('Could not flush queued submissions:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user?.id, selectedDate]);

  // Site change
  const handleSelectSite = (site: SiteProject) => {
    setCurrentSite(site);
    supervisorStorage.setActiveSite(site);
  };

  // Sync trigger to backend
  const handleSync = async () => {
    if (!user?.id || isDayLocked) return;
    setIsSyncing(true);
    try {
      await supervisorStorage.syncToBackend(user.id, selectedDate);
      setPendingSyncCount(0);
    } catch (err: any) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Data update handlers
  const handleSaveLaborers = (updated: LaborerEntry[]) => {
    setLaborers(updated);
    supervisorStorage.saveLaborers(selectedDate, updated);
    setPendingSyncCount(supervisorStorage.getPendingSyncCount());
  };

  const handleSaveOperators = (updated: OperatorEntry[]) => {
    setOperators(updated);
    supervisorStorage.saveOperators(selectedDate, updated);
    setPendingSyncCount(supervisorStorage.getPendingSyncCount());
  };

  const handleSaveEquipment = (updated: EquipmentLogEntry[]) => {
    setEquipment(updated);
    supervisorStorage.saveEquipment(selectedDate, updated);
    setPendingSyncCount(supervisorStorage.getPendingSyncCount());
  };

  const handleLockDay = async () => {
    if (!user?.id) return;
    try {
      const result = await supervisorStorage.submitDayToBackend(user.id, selectedDate);
      const freshStatus = supervisorStorage.getDayStatus(selectedDate);
      setDayStatus(freshStatus);
      setIsDayLocked(true);
      setPendingSyncCount(0);
      if (result.offline && result.message) {
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit and lock day on backend');
      throw err;
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
        isSyncing={isSyncing}
        onOpenDrawer={() => setDrawerOpen(true)}
        isDayLocked={isDayLocked}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setNotificationsModalOpen(true)}
      />

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
            reminders={reminders}
            onOpenNotifications={() => setNotificationsModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onQuickSync={handleSync}
          />
        )}

        {activeTab === 'labor' && (
          <LaborEntryView
            laborers={laborers}
            onSaveLaborers={handleSaveLaborers}
            isDayLocked={isDayLocked}
          />
        )}

        {activeTab === 'operators' && (
          <OperatorEntryView
            operators={operators}
            equipment={equipment}
            onSaveOperators={handleSaveOperators}
            isDayLocked={isDayLocked}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentLogsView
            equipment={equipment}
            operators={operators}
            onSaveEquipment={handleSaveEquipment}
            isDayLocked={isDayLocked}
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
