/**
 * SupervisorPanel.tsx — Right panel: supervisors with their assigned employees.
 */
import { UserPlus, X as XIcon } from 'lucide-react';
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import type { Assignment } from '../services/assignmentService';

interface SupervisorWithEmployees {
  supervisor: Supervisor;
  employees: { assignment: Assignment; employee: Employee }[];
}

interface Props {
  data: SupervisorWithEmployees[];
  selectedCount: number;
  onAssignTo: (supervisorId: string) => void;
  onUnassign: (assignmentId: string) => void;
}

export default function SupervisorPanel({ data, selectedCount, onAssignTo, onUnassign }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Supervisors
      </h3>

      <div className="space-y-3">
        {data.map(({ supervisor, employees }) => (
          <div key={supervisor.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {/* Supervisor header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-slate-600">{supervisor.fullName.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{supervisor.fullName}</p>
                  <p className="text-xs text-slate-400">{employees.length} assigned</p>
                </div>
              </div>
              {selectedCount > 0 && (
                <button
                  onClick={() => onAssignTo(supervisor.id)}
                  className="flex items-center gap-1 text-xs text-blue-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[36px]"
                >
                  <UserPlus size={14} />
                  <span>Assign ({selectedCount})</span>
                </button>
              )}
            </div>

            {/* Assigned employees */}
            {employees.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {employees.map(({ assignment, employee }) => (
                  <div key={assignment.id} className="flex items-center justify-between px-4 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{employee.callingName}</p>
                      <p className="text-xs text-slate-400">{employee.tradeGroup}</p>
                    </div>
                    <button
                      onClick={() => onUnassign(assignment.id)}
                      title="Unassign"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-slate-400">No employees assigned.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
