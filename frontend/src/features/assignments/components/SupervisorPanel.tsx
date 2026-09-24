/**
 * SupervisorPanel.tsx — Right panel: supervisors with their assigned employees.
 * Card design with assign buttons, collapsible employee lists, and unassign controls.
 */
import { UserPlus, X as XIcon, UserCog, ChevronDown } from 'lucide-react';
import { useState } from 'react';
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

// Color palette for supervisor avatars — cycles through these
const AVATAR_COLORS = [
  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' }, // violet
  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' }, // blue
  { bg: '#d1fae5', text: '#047857', border: '#6ee7b7' }, // emerald
  { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' }, // amber
  { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' }, // pink
  { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' }, // indigo
];

export default function SupervisorPanel({ data, selectedCount, onAssignTo, onUnassign }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalAssigned = data.reduce((sum, d) => sum + d.employees.length, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={16} className="text-violet-500" />
          <h3 className="text-sm font-medium text-slate-700">Supervisor gangs</h3>
          <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md font-medium tabular-nums">
            {data.length} supervisors
          </span>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {totalAssigned} assigned
        </span>
      </div>

      {/* Supervisor list */}
      <div
        className="flex-1 max-h-[500px] overflow-y-auto divide-y divide-slate-100 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
              <UserCog size={18} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-500 font-medium">No supervisors loaded</p>
            <p className="text-xs text-slate-400 mt-0.5">Connect to the API to load the supervisor list</p>
          </div>
        ) : (
          data.map(({ supervisor, employees }, index) => {
            const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const isCollapsed = collapsed.has(supervisor.id);

            return (
              <div key={supervisor.id} className="group">
                {/* Supervisor row */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold border"
                    style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
                  >
                    {supervisor.fullName.charAt(0)}
                  </div>

                  {/* Name + count */}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(supervisor.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{supervisor.fullName}</p>
                    </div>
                    <span className={[
                      'text-xs font-medium px-1.5 py-0.5 rounded tabular-nums',
                      employees.length > 0
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : 'text-slate-400 bg-slate-50 border border-slate-200',
                    ].join(' ')}>
                      {employees.length}
                    </span>
                    <ChevronDown
                      size={14}
                      className={[
                        'text-slate-400 transition-transform duration-200 flex-shrink-0',
                        isCollapsed ? '-rotate-90' : '',
                      ].join(' ')}
                    />
                  </button>

                  {/* Assign button */}
                  {selectedCount > 0 && (
                    <button
                      onClick={() => onAssignTo(supervisor.id)}
                      className="flex items-center gap-1 text-xs text-white font-medium bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[32px] flex-shrink-0"
                    >
                      <UserPlus size={13} />
                      <span>Assign {selectedCount}</span>
                    </button>
                  )}
                </div>

                {/* Assigned employees (collapsible) */}
                {!isCollapsed && employees.length > 0 && (
                  <div className="bg-slate-50/40 border-t border-slate-50">
                    {employees.map(({ assignment, employee }) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between pl-14 pr-4 py-2 hover:bg-slate-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color.border }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 truncate">{employee.callingName}</p>
                            <p className="text-xs text-slate-400 truncate">{employee.tradeGroup}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => onUnassign(assignment.id)}
                          title="Unassign"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state for supervisor */}
                {!isCollapsed && employees.length === 0 && (
                  <div className="pl-14 pr-4 py-2 bg-slate-50/30 border-t border-slate-50">
                    <p className="text-xs text-slate-400 italic">No employees assigned</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
