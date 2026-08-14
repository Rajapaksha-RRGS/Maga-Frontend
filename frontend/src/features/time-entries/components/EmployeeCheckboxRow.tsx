import type { AssignedEmployee } from '../services/timeEntryService';

interface EmployeeCheckboxRowProps {
  employee: AssignedEmployee;
  checked: boolean;
  onChange: (employeeId: string, checked: boolean) => void;
}

/**
 * EmployeeCheckboxRow — a checkbox row for multi-select activity assignment.
 * The entire row is a label for the checkbox, making the full row tappable.
 * Min 48px height for field touch targets.
 */
export function EmployeeCheckboxRow({
  employee,
  checked,
  onChange,
}: EmployeeCheckboxRowProps) {
  const inputId = `emp-checkbox-${employee.id}`;

  return (
    <label
      htmlFor={inputId}
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer',
        'min-h-[52px] transition-colors select-none',
        checked
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(employee.id, e.target.checked)}
        className={[
          'w-5 h-5 rounded border-slate-300 flex-shrink-0',
          'text-blue-700 accent-blue-700 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        ].join(' ')}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 leading-tight">
          {employee.callingName}
        </p>
        <p className="text-xs text-slate-500 truncate">{employee.tradeGroup}</p>
      </div>
      {checked && (
        <span className="text-xs font-medium text-blue-700 flex-shrink-0">
          Selected
        </span>
      )}
    </label>
  );
}
