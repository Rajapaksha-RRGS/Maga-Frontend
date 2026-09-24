/**
 * UnassignedPanel.tsx — Left panel: unassigned employees with checkbox multi-select.
 * Clean card design with header, search + filters, and employee list.
 */
import { UserX, CheckSquare, Square } from 'lucide-react';
import SearchInput from '../../../components/SearchInput';
import type { Employee } from '../../employees/services/employeeService';

interface Props {
  employees: Employee[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  bpFilter: string;
  onBPFilterChange: (v: string) => void;
  tgFilter: string;
  onTGFilterChange: (v: string) => void;
  businessPartners: string[];
  tradeGroups: string[];
}

const SELECT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors';

export default function UnassignedPanel({
  employees, selectedIds, onToggle, onSelectAll, onDeselectAll,
  search, onSearchChange, bpFilter, onBPFilterChange, tgFilter, onTGFilterChange,
  businessPartners, tradeGroups,
}: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX size={16} className="text-amber-500" />
          <h3 className="text-sm font-medium text-slate-700">Unassigned employees</h3>
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium tabular-nums">
            {employees.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1 text-xs text-blue-700 font-medium px-2 py-1.5 rounded-md hover:bg-blue-50 transition-colors min-h-[32px]"
            title="Select all"
          >
            <CheckSquare size={13} />
            <span className="hidden sm:inline">Select all</span>
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={onDeselectAll}
              className="flex items-center gap-1 text-xs text-slate-500 font-medium px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors min-h-[32px]"
            >
              <Square size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 space-y-2">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search employees…" />
        <div className="flex flex-wrap gap-2">
          <select value={bpFilter} onChange={(e) => onBPFilterChange(e.target.value)} className={`${SELECT_CLASS} text-xs flex-1 min-w-[120px]`} aria-label="Filter by business partner">
            <option value="">All partners</option>
            {businessPartners.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
          </select>
          <select value={tgFilter} onChange={(e) => onTGFilterChange(e.target.value)} className={`${SELECT_CLASS} text-xs flex-1 min-w-[120px]`} aria-label="Filter by trade group">
            <option value="">All trades</option>
            {tradeGroups.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        </div>
      </div>

      {/* Employee list */}
      <div
        className="flex-1 max-h-[420px] overflow-y-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
              <UserX size={18} className="text-emerald-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">All employees are assigned</p>
            <p className="text-xs text-slate-400 mt-0.5">Everyone has been allocated to a supervisor</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {employees.map((emp) => {
              const isSelected = selectedIds.has(emp.id);
              return (
                <label
                  key={emp.id}
                  className={[
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-blue-50/70'
                      : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(emp.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700 accent-blue-700 flex-shrink-0"
                  />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                    style={{
                      backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                      color: isSelected ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    {emp.callingName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{emp.callingName}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.tradeGroup} · {emp.businessPartner}</p>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-blue-50/40">
          <p className="text-xs font-medium text-blue-700 tabular-nums">
            {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected — choose a supervisor to assign
          </p>
        </div>
      )}
    </div>
  );
}
