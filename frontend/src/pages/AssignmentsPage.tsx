/**
 * AssignmentsPage.tsx — Admin daily labour assignment page.
 *
 * Layout:
 *   1. Page header with icon + description
 *   2. Stat cards row (total employees, assigned, unassigned, supervisors)
 *   3. Toolbar (date, copy, bulk)
 *   4. Two-panel: unassigned (left) + supervisor gangs (right)
 */
import { HardHat, Users, UserCheck, UserX, UserCog } from 'lucide-react';
import { useAssignments } from '../features/assignments/hooks/useAssignments';
import UnassignedPanel from '../features/assignments/components/UnassignedPanel';
import SupervisorPanel from '../features/assignments/components/SupervisorPanel';
import AssignmentToolbar from '../features/assignments/components/AssignmentToolbar';

export default function AssignmentsPage() {
  const hook = useAssignments();

  const totalEmployees = hook.employees.length;
  const assignedCount = totalEmployees - hook.unassignedCount;
  const assignRate = totalEmployees > 0 ? Math.round((assignedCount / totalEmployees) * 100) : 0;
  const supervisorCount = hook.supervisors.length;

  return (
    <div className="px-4 md:px-6 py-5">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
          <HardHat size={18} className="text-emerald-700" />
        </div>
        <div>
          <h1 className="text-base font-medium text-slate-800">Labour assign</h1>
          <p className="text-xs text-slate-400 mt-0.5">Assign labour employees to supervisors for daily operations</p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Total employees */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total employees</p>
            <p className="text-xl font-semibold text-slate-800 tabular-nums leading-tight">
              {hook.isLoading ? '—' : totalEmployees}
            </p>
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <UserCheck size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Assigned</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-semibold text-emerald-700 tabular-nums leading-tight">
                {hook.isLoading ? '—' : assignedCount}
              </p>
              {!hook.isLoading && totalEmployees > 0 && (
                <span className="text-xs font-medium text-emerald-500 tabular-nums">{assignRate}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Unassigned */}
        <div className={[
          'border rounded-lg px-4 py-3.5 flex items-center gap-3',
          !hook.isLoading && hook.unassignedCount > 0
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-white border-slate-200',
        ].join(' ')}>
          <div className={[
            'w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0',
            !hook.isLoading && hook.unassignedCount > 0
              ? 'bg-amber-100 border-amber-200'
              : 'bg-slate-50 border-slate-100',
          ].join(' ')}>
            <UserX size={18} className={
              !hook.isLoading && hook.unassignedCount > 0 ? 'text-amber-600' : 'text-slate-400'
            } />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Unassigned</p>
            <p className={[
              'text-xl font-semibold tabular-nums leading-tight',
              !hook.isLoading && hook.unassignedCount > 0 ? 'text-amber-700' : 'text-slate-800',
            ].join(' ')}>
              {hook.isLoading ? '—' : hook.unassignedCount}
            </p>
          </div>
        </div>

        {/* Supervisors */}
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <UserCog size={18} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Supervisors</p>
            <p className="text-xl font-semibold text-slate-800 tabular-nums leading-tight">
              {hook.isLoading ? '—' : supervisorCount}
            </p>
          </div>
        </div>
      </div>

      {/* ── Assignment progress bar ── */}
      {!hook.isLoading && totalEmployees > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-500">Assignment progress</p>
            <p className="text-xs font-medium text-slate-500 tabular-nums">{assignedCount}/{totalEmployees}</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${assignRate}%`,
                background: assignRate === 100
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : assignRate >= 50
                    ? 'linear-gradient(90deg, #2563eb, #3b82f6)'
                    : 'linear-gradient(90deg, #d97706, #f59e0b)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="mb-5">
        <AssignmentToolbar
          selectedDate={hook.selectedDate}
          onDateChange={hook.setSelectedDate}
          onCopyPreviousDay={hook.copyPreviousDay}
          onCopyFromDate={hook.copyFromSpecificDate}
          supervisors={hook.supervisors}
          tradeGroups={hook.tradeGroups}
          businessPartners={hook.businessPartners}
          onBulkAssign={hook.bulkAssignByGroup}
          getRecentGangSummaries={hook.getRecentGangSummaries}
          onRefresh={() => hook.refresh(true)}
          isLoading={hook.isLoading}
        />
      </div>

      {/* ── Loading ── */}
      {hook.isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-400">Loading assignments…</p>
        </div>
      )}

      {/* ── Two-panel layout ── */}
      {!hook.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <UnassignedPanel
            employees={hook.unassignedEmployees}
            selectedIds={hook.selectedEmployeeIds}
            onToggle={hook.toggleEmployeeSelection}
            onSelectAll={hook.selectAllUnassigned}
            onDeselectAll={hook.deselectAll}
            search={hook.employeeSearch}
            onSearchChange={hook.setEmployeeSearch}
            bpFilter={hook.employeeBPFilter}
            onBPFilterChange={hook.setEmployeeBPFilter}
            tgFilter={hook.employeeTGFilter}
            onTGFilterChange={hook.setEmployeeTGFilter}
            businessPartners={hook.businessPartners}
            tradeGroups={hook.tradeGroups}
          />
          <SupervisorPanel
            data={hook.supervisorAssignments}
            selectedCount={hook.selectedEmployeeIds.size}
            onAssignTo={hook.assignToSupervisor}
            onUnassign={hook.unassignEmployee}
          />
        </div>
      )}
    </div>
  );
}
