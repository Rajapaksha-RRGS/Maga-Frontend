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
          {/* Avatar initial */}
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-slate-600">
              {emp.callingName.charAt(0)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{emp.callingName}</p>
            <p className="text-xs text-slate-500 truncate">
              {emp.tradeGroup} · {emp.businessPartner}
            </p>
          </div>

          <StatusBadge status={emp.status} />
        </button>
      )}
    />
  );
}
