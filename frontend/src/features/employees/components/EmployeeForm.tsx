/**
 * EmployeeForm.tsx
 *
 * Add/edit form for employees, rendered inside a SlidePanel.
 * Fields match the `employees` table in dev-system-spec.md:
 *   calling_name, full_name, business_partner, trade_group, nic_no
 */
import { useState, useEffect, type FormEvent } from 'react';
import type { Employee, EmployeeFormData } from '../services/employeeService';

interface EmployeeFormProps {
  /** If provided, form is in edit mode for this employee */
  employee?: Employee | null;
  onSave: (data: EmployeeFormData) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function EmployeeForm({
  employee,
  onSave,
  onDeactivate,
  onCancel,
}: EmployeeFormProps) {
  const [callingName, setCallingName] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPartner, setBusinessPartner] = useState('');
  const [tradeGroup, setTradeGroup] = useState('');
  const [nicNo, setNicNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Populate for edit
  useEffect(() => {
    if (employee) {
      setCallingName(employee.callingName);
      setFullName(employee.fullName);
      setBusinessPartner(employee.businessPartner);
      setTradeGroup(employee.tradeGroup);
      setNicNo(employee.nicNo);
    } else {
      setCallingName('');
      setFullName('');
      setBusinessPartner('');
      setTradeGroup('');
      setNicNo('');
    }
  }, [employee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!callingName.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        callingName: callingName.trim(),
        fullName: fullName.trim(),
        businessPartner: businessPartner.trim(),
        tradeGroup: tradeGroup.trim(),
        nicNo: nicNo.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-calling-name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Calling name *
        </label>
        <input id="emp-calling-name" type="text" value={callingName} onChange={(e) => setCallingName(e.target.value)} className={INPUT_CLASS} placeholder="Calling name" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="emp-full-name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Full name
        </label>
        <input id="emp-full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLASS} placeholder="Full name" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="emp-bp" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Business partner
        </label>
        <input id="emp-bp" type="text" value={businessPartner} onChange={(e) => setBusinessPartner(e.target.value)} className={INPUT_CLASS} placeholder="Business partner" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="emp-tg" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Trade group
        </label>
        <input id="emp-tg" type="text" value={tradeGroup} onChange={(e) => setTradeGroup(e.target.value)} className={INPUT_CLASS} placeholder="Trade group" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="emp-nic" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          NIC no.
        </label>
        <input id="emp-nic" type="text" value={nicNo} onChange={(e) => setNicNo(e.target.value)} className={INPUT_CLASS} placeholder="e.g. 881234567V" />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={isSaving || !callingName.trim()}
          className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
        </button>

        {employee && employee.status === 'active' && onDeactivate && (
          <button
            type="button"
            onClick={() => onDeactivate(employee.id)}
            className="w-full border border-slate-200 text-slate-700 font-medium rounded-lg min-h-[48px] px-4 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Deactivate employee
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-slate-500 py-2 transition-colors hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
