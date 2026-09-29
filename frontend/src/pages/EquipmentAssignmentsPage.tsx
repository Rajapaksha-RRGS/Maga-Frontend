/**
 * EquipmentAssignmentsPage.tsx — Admin equipment-to-supervisor assignment page.
 *
 * Two-panel ERP layout: unassigned equipment (left) + supervisors with assigned equipment (right).
 * Connected to live backend API with real-time assignment, unassignment, date switching & copying.
 */
import {
  Search,
  UserPlus,
  Truck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Copy,
  CheckSquare,
  Square,
  X,
  CheckCircle2,
  Clock,
  Coins,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useEquipmentAssignments } from '../features/assignments/hooks/useEquipmentAssignments';

function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[dt.getUTCDay()];
}

// Avatar color palette for supervisors
const AVATAR_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
];

export default function EquipmentAssignmentsPage() {
  const {
    selectedDate,
    setSelectedDate,
    isLoading,
    isSaving,
    unassignedEquipment,
    supervisorAssignments,
    totalEquipment,
    assignedCount,
    unassignedCount,
    selectedEquipmentIds,
    toggleEquipmentSelection,
    selectAllUnassigned,
    deselectAll,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    distinctTypes,
    assignToSupervisor,
    unassignEquipment,
    copyPreviousDay,
    refresh,
  } = useEquipmentAssignments();

  const isToday = selectedDate === getTodayStr();

  return (
    <div className="px-4 md:px-6 py-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Equipment assign</h1>
            <Breadcrumb items={[{ label: 'Assignments', to: '/admin/assignments/labour' }, { label: 'Equipment assign' }]} className="mt-1" />
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving || isLoading}
            onClick={copyPreviousDay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Copy previous day's equipment assignments to today"
          >
            <Copy size={13} className="text-slate-500" />
            <span>Copy yesterday</span>
          </button>
          <button
            type="button"
            disabled={isSaving || isLoading}
            onClick={refresh}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            title="Refresh equipment assignments"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Total Equipment */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Equipment</p>
            <p className="text-xl font-semibold text-slate-800 tabular-nums leading-tight">
              {isLoading ? '—' : totalEquipment}
            </p>
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Assigned</p>
            <p className="text-xl font-semibold text-emerald-700 tabular-nums leading-tight">
              {isLoading ? '—' : assignedCount}
            </p>
          </div>
        </div>

        {/* Unassigned */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Unassigned</p>
            <p className="text-xl font-semibold text-amber-700 tabular-nums leading-tight">
              {isLoading ? '—' : unassignedCount}
            </p>
          </div>
        </div>

        {/* Supervisors */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <UserPlus size={18} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Supervisors</p>
            <p className="text-xl font-semibold text-slate-800 tabular-nums leading-tight">
              {isLoading ? '—' : supervisorAssignments.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Date Selector with Previous / Next Day controls */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-100">
            <Calendar size={16} className="text-amber-600 flex-shrink-0" />
            <input
              id="eq-assign-date"
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer font-mono"
            />
            <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md hidden sm:inline-block">
              {getDayName(selectedDate)}
            </span>
            {isToday && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Jump to Today"
            >
              Today
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="eq-assign-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment, code, type…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors"
          />
        </div>

        {/* Type Filter */}
        {distinctTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 min-h-[44px] focus:ring-2 focus:ring-blue-600 outline-none"
          >
            <option value="">All Types ({distinctTypes.length})</option>
            {distinctTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="py-16 text-center text-slate-400 text-sm">
          <RotateCw size={24} className="animate-spin mx-auto text-amber-600 mb-2" />
          <p>Loading equipment assignments…</p>
        </div>
      )}

      {/* ── Two-Panel ERP Layout ── */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ── Left Panel: Unassigned Equipment ── */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-xs">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-slate-800">Unassigned Equipment</h2>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full tabular-nums">
                  {unassignedEquipment.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllUnassigned}
                  disabled={unassignedEquipment.length === 0}
                  className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-40 cursor-pointer"
                  title="Select all unassigned"
                >
                  <CheckSquare size={13} />
                  <span>Select all</span>
                </button>
                {selectedEquipmentIds.size > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Square size={13} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="p-3 divide-y divide-slate-100 max-h-[calc(100vh-340px)] overflow-y-auto">
              {unassignedEquipment.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                    <Truck size={22} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">No unassigned equipment</p>
                  <p className="text-xs text-slate-400">
                    All registered site equipment items are assigned for {selectedDate}.
                  </p>
                </div>
              ) : (
                unassignedEquipment.map((eq) => {
                  const isChecked = selectedEquipmentIds.has(eq.id);
                  return (
                    <div
                      key={eq.id}
                      onClick={() => toggleEquipmentSelection(eq.id)}
                      className={[
                        'py-2.5 px-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors',
                        isChecked ? 'bg-amber-50/70 border border-amber-200' : 'hover:bg-slate-50 border border-transparent',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEquipmentSelection(eq.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {eq.code || 'NO-CODE'}
                            </span>
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {eq.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            {eq.type && (
                              <span className="bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded font-medium text-slate-600">
                                {eq.type}
                              </span>
                            )}
                            {eq.costRate !== undefined && Number(eq.costRate) > 0 && (
                              <span className="flex items-center gap-1 font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                <Coins size={10} />
                                <span>LKR {Number(eq.costRate).toLocaleString()}/hr</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right Panel: Supervisor Gangs ── */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-xs">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-violet-600" />
                <h2 className="text-sm font-semibold text-slate-800">Supervisor Equipment Gangs</h2>
                <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full tabular-nums">
                  {supervisorAssignments.length} supervisors
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                {assignedCount} items assigned
              </span>
            </div>

            {/* Supervisor Cards List */}
            <div className="p-3 space-y-3.5 max-h-[calc(100vh-340px)] overflow-y-auto">
              {supervisorAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                    <UserPlus size={22} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">No supervisors loaded</p>
                  <p className="text-xs text-slate-400">Ensure active supervisor records are created in master data.</p>
                </div>
              ) : (
                supervisorAssignments.map(({ supervisor, equipmentList: assignedEqs }, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  const hasSelection = selectedEquipmentIds.size > 0;

                  return (
                    <div
                      key={supervisor.id}
                      className="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      {/* Supervisor Header */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={[
                              'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border flex-shrink-0',
                              avatarColor.bg,
                              avatarColor.text,
                              avatarColor.border,
                            ].join(' ')}
                          >
                            {supervisor.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-semibold text-slate-900 truncate">
                              {supervisor.fullName}
                            </h3>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {assignedEqs.length} equipment item{assignedEqs.length !== 1 ? 's' : ''} assigned
                            </span>
                          </div>
                        </div>

                        {/* Assign Button */}
                        <button
                          type="button"
                          disabled={!hasSelection || isSaving}
                          onClick={() => assignToSupervisor(supervisor.id)}
                          className={[
                            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer',
                            hasSelection
                              ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed',
                          ].join(' ')}
                        >
                          <UserPlus size={13} />
                          <span>
                            {hasSelection ? `Assign (${selectedEquipmentIds.size})` : 'Assign'}
                          </span>
                        </button>
                      </div>

                      {/* Assigned Equipment Items */}
                      {assignedEqs.length === 0 ? (
                        <div className="py-2.5 px-3 rounded-lg bg-slate-50/70 border border-dashed border-slate-200 text-center">
                          <span className="text-[11px] text-slate-400">No equipment assigned yet for today</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          {assignedEqs.map(({ assignment, equipment: eq }) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-150 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-semibold text-slate-800 text-[11px] bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                  {eq.code || assignment.equipmentCode}
                                </span>
                                <span className="font-medium text-slate-700 truncate max-w-[150px]">
                                  {eq.name || assignment.equipmentName}
                                </span>
                                {(eq.type || assignment.equipmentType) && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1 rounded hidden sm:inline-block">
                                    {eq.type || assignment.equipmentType}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => unassignEquipment(assignment.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title={`Unassign ${eq.name || 'equipment'}`}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
