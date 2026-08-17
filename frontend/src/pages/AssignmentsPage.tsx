/**
 * AssignmentsPage.tsx — Admin daily assignment page.
 * Two-panel layout: unassigned employees (left) + supervisors with assigned employees (right).
 */
import { AlertTriangle } from 'lucide-react';
import { useAssignments } from '../features/assignments/hooks/useAssignments';
import UnassignedPanel from '../features/assignments/components/UnassignedPanel';
import SupervisorPanel from '../features/assignments/components/SupervisorPanel';
import AssignmentToolbar from '../features/assignments/components/AssignmentToolbar';

export default function AssignmentsPage() {
  const hook = useAssignments();

  return (
    <div className="px-4 md:px-6 py-5">
      <h1 className="text-base font-medium text-slate-800 mb-5">Daily assignment</h1>

      {/* Toolbar */}
      <div className="mb-5">
        <AssignmentToolbar
          selectedDate={hook.selectedDate}
          onDateChange={hook.setSelectedDate}
          onCopyPreviousDay={hook.copyPreviousDay}
          supervisors={hook.supervisors}
          tradeGroups={hook.tradeGroups}
          businessPartners={hook.businessPartners}
          onBulkAssign={hook.bulkAssignByGroup}
        />
      </div>

      {/* Unassigned warning */}
      {!hook.isLoading && hook.unassignedCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-medium">{hook.unassignedCount}</span> employee{hook.unassignedCount !== 1 ? 's' : ''} still unassigned for this date.
          </p>
        </div>
      )}

      {hook.isLoading && (
        <p className="text-sm text-slate-400 py-8 text-center">Loading assignments…</p>
      )}

      {/* Two-panel layout */}
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
