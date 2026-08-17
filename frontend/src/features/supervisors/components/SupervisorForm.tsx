/**
 * SupervisorForm.tsx — Add supervisor form with employee linking.
 */
import { useState, type FormEvent } from 'react';
import type { Employee } from '../../employees/services/employeeService';

interface Props {
  employees: Employee[];
  onSave: (data: { fullName: string; username: string; linkedEmployeeId: string | null }) => Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function SupervisorForm({ employees, onSave, onCancel }: Props) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [linkEmployee, setLinkEmployee] = useState(false);
  const [linkedEmployeeId, setLinkedEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredEmployees = employees.filter((e) =>
    !employeeSearch || e.callingName.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        username: username.trim(),
        linkedEmployeeId: linkEmployee && linkedEmployeeId ? linkedEmployeeId : null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="sup-name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Full name *</label>
        <input id="sup-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLASS} placeholder="Full name" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sup-username" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Username *</label>
        <input id="sup-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT_CLASS} placeholder="Username" required />
      </div>

      <p className="text-xs text-slate-400">A temporary password will be auto-generated and shown once after saving.</p>

      {/* Link to employee checkbox */}
      <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={linkEmployee}
          onChange={(e) => setLinkEmployee(e.target.checked)}
          className="w-5 h-5 rounded border-slate-300 text-blue-700 accent-blue-700"
        />
        <span className="text-sm text-slate-800">Link to an employee record</span>
      </label>

      {/* Employee picker */}
      {linkEmployee && (
        <div className="flex flex-col gap-2 pl-8">
          <input
            type="text"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            placeholder="Search employees…"
            className={INPUT_CLASS}
          />
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => { setLinkedEmployeeId(emp.id); setEmployeeSearch(emp.callingName); }}
                className={[
                  'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600',
                  linkedEmployeeId === emp.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-800',
                ].join(' ')}
              >
                {emp.callingName} <span className="text-slate-400">— {emp.tradeGroup}</span>
              </button>
            ))}
            {filteredEmployees.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">No employees found.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={isSaving || !fullName.trim() || !username.trim()} className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
          {isSaving ? 'Saving…' : 'Add supervisor'}
        </button>
        <button type="button" onClick={onCancel} className="w-full text-sm text-slate-500 py-2 transition-colors hover:text-slate-700">Cancel</button>
      </div>
    </form>
  );
}
