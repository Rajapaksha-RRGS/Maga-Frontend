/**
 * EmployeeCardList.tsx — Mobile card rendering for employee list.
 * Visible below md only (hidden on md+ via CardList).
 */
import CardList from '../../../components/CardList';
import StatusBadge from '../../../components/StatusBadge';
import type { Employee } from '../services/employeeService';

interface EmployeeCardListProps {
  data: Employee[];
  onCardClick: (emp: Employee) => void;
}

export default function EmployeeCardList({ data, onCardClick }: EmployeeCardListProps) {
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

          <StatusBadge status={emp.status} />
        </button>
      )}
    />
  );
}
