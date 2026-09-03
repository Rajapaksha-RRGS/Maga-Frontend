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
  const [employeeCode, setEmployeeCode] = useState('');
  const [callingName, setCallingName] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPartner, setBusinessPartner] = useState('');
  const [tradeGroup, setTradeGroup] = useState('');
  const [nicNo, setNicNo] = useState('');
  const [dailyRate, setDailyRate] = useState('1400');
  const [epfNo, setEpfNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Populate for edit
  useEffect(() => {
    if (employee) {
      setEmployeeCode(employee.employeeCode || employee.id);
      setCallingName(employee.callingName || '');
      setFullName(employee.fullName || '');
      setBusinessPartner(employee.businessPartner || 'Maga');
      setTradeGroup(employee.tradeGroup || '');
      setNicNo(employee.nicNo || '');
      setDailyRate(employee.dailyRate != null ? String(employee.dailyRate) : '1400');
      setEpfNo(employee.epfNo || '');
    } else {
      setEmployeeCode('');
      setCallingName('');
      setFullName('');
      setBusinessPartner('Maga');
      setTradeGroup('');
      setNicNo('');
      setDailyRate('1400');
      setEpfNo('');
    }
  }, [employee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tradeGroup.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        employeeCode: employeeCode.trim() || undefined,
        callingName: callingName.trim() || employeeCode.trim() || 'Worker',
        fullName: fullName.trim() || callingName.trim() || employeeCode.trim() || 'Worker',
        businessPartner: businessPartner.trim() || 'Maga',
        tradeGroup: tradeGroup.trim(),
        nicNo: nicNo.trim(),
        dailyRate: parseFloat(dailyRate) || 1400,
        epfNo: epfNo.trim() || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Trade Group */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-tg" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Trade group *
        </label>
        <input
          id="emp-tg"
          type="text"
          value={tradeGroup}
          onChange={(e) => setTradeGroup(e.target.value)}
          className={INPUT_CLASS}
          placeholder="e.g. Lab Helper, Cook, Helper, Carpenter"
          required
        />
      </div>

      {/* NIC No. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-nic" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          NIC No.
        </label>
        <input
          id="emp-nic"
          type="text"
          value={nicNo}
          onChange={(e) => setNicNo(e.target.value)}
          className={INPUT_CLASS}
          placeholder="e.g. 961173612V / 200531503866"
        />
      </div>

      {/* Daily Rate */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-rate" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Daily Rate (LKR) *
        </label>
        <input
          id="emp-rate"
          type="number"
          step="0.01"
          value={dailyRate}
          onChange={(e) => setDailyRate(e.target.value)}
          className={INPUT_CLASS}
          placeholder="1400.00"
          required
        />
      </div>

      {/* Business Partner */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-bp" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Business partner *
        </label>
        <input
          id="emp-bp"
          type="text"
          value={businessPartner}
          onChange={(e) => setBusinessPartner(e.target.value)}
          className={INPUT_CLASS}
          placeholder="e.g. Maga"
          required
        />
      </div>

      {/* Employee Code */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-code" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Employee Code
        </label>
        <input
          id="emp-code"
          type="text"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          className={INPUT_CLASS}
          placeholder="e.g. HK030, HI258"
        />
      </div>

      {/* EPF No */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-epf" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          EPF No
        </label>
        <input
          id="emp-epf"
          type="text"
          value={epfNo}
          onChange={(e) => setEpfNo(e.target.value)}
          className={INPUT_CLASS}
          placeholder="EPF No (optional)"
        />
      </div>

      {/* Optional details (Calling name / Full name) */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-col gap-1">
          <label htmlFor="emp-calling-name" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Calling Name
          </label>
          <input
            id="emp-calling-name"
            type="text"
            value={callingName}
            onChange={(e) => setCallingName(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Calling name"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="emp-full-name" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Full Name
          </label>
          <input
            id="emp-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Full name"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={isSaving || !tradeGroup.trim()}
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
