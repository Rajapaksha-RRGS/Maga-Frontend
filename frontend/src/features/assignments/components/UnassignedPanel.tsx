/**
 * UnassignedPanel.tsx — Left panel: unassigned employees with checkbox multi-select.
 */
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Unassigned ({employees.length})
        </h3>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-xs text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
            Select all
          </button>
          {selectedIds.size > 0 && (
            <button onClick={onDeselectAll} className="text-xs text-slate-500 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors">
              Deselect
            </button>
          )}
        </div>
      </div>

      <SearchInput value={search} onChange={onSearchChange} placeholder="Search employees…" />

      <div className="flex flex-wrap gap-2">
        <select value={bpFilter} onChange={(e) => onBPFilterChange(e.target.value)} className={SELECT_CLASS} aria-label="Filter by business partner">
          <option value="">All partners</option>
          {businessPartners.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
        </select>
        <select value={tgFilter} onChange={(e) => onTGFilterChange(e.target.value)} className={SELECT_CLASS} aria-label="Filter by trade group">
          <option value="">All trades</option>
          {tradeGroups.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
        </select>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {employees.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            All employees are assigned.
          </p>
        )}
        {employees.map((emp) => {
          const isSelected = selectedIds.has(emp.id);
          return (
            <label
              key={emp.id}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors min-h-[44px]',
                isSelected
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(emp.id)}
                className="w-5 h-5 rounded border-slate-300 text-blue-700 accent-blue-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{emp.callingName}</p>
                <p className="text-xs text-slate-500 truncate">{emp.tradeGroup} · {emp.businessPartner}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
