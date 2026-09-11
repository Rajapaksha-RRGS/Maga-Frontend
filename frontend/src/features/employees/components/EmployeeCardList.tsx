
import CardList from '../../../components/CardList';
import StatusBadge from '../../../components/StatusBadge';
import type { Employee } from '../services/employeeService';

interface EmployeeCardListProps {
  data: Employee[];
  onCardClick: (emp: Employee) => void;
  onToggleStatus?: (id: string, currentStatus: 'active' | 'inactive') => void;
}

export default function EmployeeCardList({ data, onCardClick, onToggleStatus }: EmployeeCardListProps) {
  return (
    <CardList
      data={data}
      keyField="id"
      renderCard={(emp) => (
        <button
          onClick={() => onCardClick(emp)}
          className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {/* Avatar / Code badge */}
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-semibold flex items-center justify-center flex-shrink-0 border border-blue-100">
            {emp.employeeCode || emp.id}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800 truncate">{emp.tradeGroup}</p>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono font-medium text-slate-700">
                {emp.dailyRate != null ? `Rs. ${Number(emp.dailyRate).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              NIC: {emp.nicNo || '—'} {emp.epfNo ? `· EPF: ${emp.epfNo}` : ''}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {emp.businessPartner}
            </p>
          </div>

          <div
            className="flex flex-col items-end gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <StatusBadge status={emp.status} />
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(emp.id, emp.status)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                  emp.status === 'active'
                    ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200'
                    : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {emp.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        </button>
      )}
    />
  );
}
