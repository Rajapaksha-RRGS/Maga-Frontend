import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  supervisorStorage, 
  type LaborerEntry, 
  type OperatorEntry, 
  type EquipmentLogEntry, 
  type SiteProject 
} from './services/supervisorStorageService';

// Layout & Components
import { SupervisorTopBar } from './components/SupervisorTopBar';
import { SupervisorDrawer } from './components/SupervisorDrawer';
import { SupervisorSubHeader } from './components/SupervisorSubHeader';
import { SupervisorBottomNav, type SupervisorTabKey } from './components/SupervisorBottomNav';
import { QuickAssignModal } from './components/QuickAssignModal';

// 5 Dedicated Tab Views
import { SupervisorDashboardView } from './views/SupervisorDashboardView';
import { LaborEntryView } from './views/LaborEntryView';
import { OperatorEntryView } from './views/OperatorEntryView';
import { EquipmentLogsView } from './views/EquipmentLogsView';
import { DailySummaryView } from './views/DailySummaryView';

export default function SupervisorMobileApp() {
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<SupervisorTabKey>('dashboard');
  const [currentSite, setCurrentSite] = useState<SiteProject>(() => supervisorStorage.getActiveSite());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sync state
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => supervisorStorage.getPendingSyncCount());
  const [isSyncing, setIsSyncing] = useState(false);

  // Data state per selected date
  const [laborers, setLaborers] = useState<LaborerEntry[]>([]);
  const [operators, setOperators] = useState<OperatorEntry[]>([]);
  const [equipment, setEquipment] = useState<EquipmentLogEntry[]>([]);
  const [isDayLocked, setIsDayLocked] = useState(false);

  // Load data whenever selectedDate changes (Offline-First: cached first, then fresh backend)
  useEffect(() => {
    // 1. Instant render from local cache
    const loadedLaborers = supervisorStorage.getLaborers(selectedDate);
    const loadedOperators = supervisorStorage.getOperators(selectedDate);
    const loadedEquipment = supervisorStorage.getEquipment(selectedDate);
    const locked = supervisorStorage.isDayLocked(selectedDate);

    setLaborers(loadedLaborers);
    setOperators(loadedOperators);
    setEquipment(loadedEquipment);
    setIsDayLocked(locked);
    setPendingSyncCount(supervisorStorage.getPendingSyncCount());

    // 2. Fetch fresh real data from backend (Admin assigned workers & entries)
    if (user?.id) {
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

      supervisorStorage.fetchEquipment()
        .then((freshEquipment) => {
          if (freshEquipment.length > 0) {
            setEquipment(freshEquipment);
          }
        })
        .catch(() => {});
    }
  }, [selectedDate, user?.id]);

  // Site change
  const handleSelectSite = (site: SiteProject) => {
    setCurrentSite(site);
    supervisorStorage.setActiveSite(site);
  };

  // Sync trigger to backend
  const handleSync = async () => {
    if (!user?.id) return;
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
      await supervisorStorage.submitDayToBackend(user.id, selectedDate);
      setIsDayLocked(true);
      setPendingSyncCount(0);
    } catch (err: any) {
      alert(err.message || 'Failed to submit and lock day on backend');
    }
  };

  const handleUnlockDay = () => {
    supervisorStorage.unlockDay(selectedDate);
    setIsDayLocked(false);
  };


  // Compute badge counts for Bottom Nav
  const laborPendingCount = laborers.filter((l) => !l.inTime || !l.outTime).length;
  const operatorPendingCount = operators.filter((o) => !o.assignedEquipmentId || !o.inTime).length;
  const equipmentPendingCount = equipment.filter((e) => e.netHours === 0).length;

  const supervisorDisplayName = user?.fullName || 'Supervisor';

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
      />

      {/* ── Slide Drawer ────────────────────────────────────────────────────── */}
      <SupervisorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pendingSyncCount={pendingSyncCount}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      {/* ── Sub-Header (Date Stepper & Contextual Action) ──────────────────── */}
      <SupervisorSubHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        rightAction={
          activeTab === 'labor' ? (
            <button
              type="button"
              onClick={() => setQuickAssignOpen(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs transition-colors shadow-xs active:scale-[0.98] flex-shrink-0"
            >
              <UserPlus size={14} />
              <span>+ Quick</span>
            </button>
          ) : null
        }
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
          />
        )}

        {activeTab === 'operators' && (
          <OperatorEntryView
            operators={operators}
            equipment={equipment}
            onSaveOperators={handleSaveOperators}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentLogsView
            equipment={equipment}
            operators={operators}
            onSaveEquipment={handleSaveEquipment}
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
            onLockDay={handleLockDay}
            onUnlockDay={handleUnlockDay}
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

      {/* ── Standby Laborer Quick Assign Modal ─────────────────────────────── */}
      <QuickAssignModal
        open={quickAssignOpen}
        onClose={() => setQuickAssignOpen(false)}
        onAssignWorker={(newWorker) => {
          handleSaveLaborers([...laborers, { ...newWorker, status: 'draft' }]);
        }}
        alreadyAssignedIds={laborers.map((l) => l.id)}
      />
    </div>
  );
}
