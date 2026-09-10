/**
 * EmployeeForm.tsx
 *
 * Add/edit form for employees, rendered inside a SlidePanel.
 * Fields match the `employees` table in dev-system-spec.md:
 *   calling_name, full_name, business_partner, trade_group, nic_no
 */
import { useState, useEffect, type FormEvent } from 'react';
import type { Employee, EmployeeFormData } from '../services/employeeService';
import type { BusinessPartner } from '../../business-partners/services/businessPartnerService';
import * as businessPartnerService from '../../business-partners/services/businessPartnerService';

interface EmployeeFormProps {
  /** If provided, form is in edit mode for this employee */
  employee?: Employee | null;
  businessPartners?: BusinessPartner[];
  onSave: (data: EmployeeFormData) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function EmployeeForm({
  employee,
  businessPartners,
  onSave,
  onDeactivate,
  onCancel,
}: EmployeeFormProps) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [callingName, setCallingName] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPartnerId, setBusinessPartnerId] = useState('');
  const [tradeGroup, setTradeGroup] = useState('');
  const [nicNo, setNicNo] = useState('');
  const [dailyRate, setDailyRate] = useState('1400');
  const [epfNo, setEpfNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [partners, setPartners] = useState<BusinessPartner[]>(businessPartners || []);
  const [loadingPartners, setLoadingPartners] = useState(!businessPartners || businessPartners.length === 0);

  // Fetch partners if not supplied via props
  useEffect(() => {
    if (businessPartners && businessPartners.length > 0) {
      setPartners(businessPartners);
      setLoadingPartners(false);
      return;
    }
    let isMounted = true;
    setLoadingPartners(true);
    businessPartnerService.getAll()
      .then((res) => {
        if (isMounted) setPartners(res);
      })
      .catch((err) => {
        console.error('Failed to load business partners:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPartners(false);
      });
    return () => { isMounted = false; };
  }, [businessPartners]);

  // Populate for edit / reset for add
  useEffect(() => {
    if (employee) {
      setEmployeeCode(employee.employeeCode || employee.id);
      setCallingName(employee.callingName || '');
      setFullName(employee.fullName || '');

      // Resolve businessPartnerId if already present, or match by name
      if (employee.businessPartnerId) {
        setBusinessPartnerId(employee.businessPartnerId);
      } else {
        const matched = partners.find(
          (p) => p.name.toLowerCase() === employee.businessPartner.toLowerCase() || p.id === employee.businessPartner
        );
        setBusinessPartnerId(matched ? matched.id : '');
      }

      setTradeGroup(employee.tradeGroup || '');
      setNicNo(employee.nicNo || '');
      setDailyRate(employee.dailyRate != null ? String(employee.dailyRate) : '1400');
      setEpfNo(employee.epfNo || '');
    } else {
      setEmployeeCode('');
      setCallingName('');
      setFullName('');
      // If partners available and none selected yet, default to first or empty
      setBusinessPartnerId('');
      setTradeGroup('');
      setNicNo('');
      setDailyRate('1400');
      setEpfNo('');
    }
  }, [employee, partners]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tradeGroup.trim() || !businessPartnerId) return;
    const selectedPartner = partners.find((p) => p.id === businessPartnerId);

    setIsSaving(true);
    try {
      await onSave({
        employeeCode: employeeCode.trim() || undefined,
        callingName: callingName.trim() || employeeCode.trim() || 'Worker',
        fullName: fullName.trim() || callingName.trim() || employeeCode.trim() || 'Worker',
        businessPartnerId: businessPartnerId,
        businessPartner: selectedPartner?.name || '',
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
      {/* Business Partner selection */}
      <div className="flex flex-col gap-1">
        <label htmlFor="emp-bp" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Business partner *
        </label>
        {partners.length === 0 && !loadingPartners ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex flex-col gap-2">
            <p className="font-semibold">
              No registered business partners found!
            </p>
            <p className="text-amber-700">
              An employee must belong to a registered business partner. Please register a business partner before adding employees.
            </p>
            <a
              href="/admin/business-partners"
              className="inline-flex items-center justify-center font-medium bg-amber-600 hover:bg-amber-700 text-white rounded px-3 py-1.5 transition-colors self-start"
            >
              Register Business Partner
            </a>
          </div>
        ) : (
          <select
            id="emp-bp"
            value={businessPartnerId}
            onChange={(e) => setBusinessPartnerId(e.target.value)}
            className={INPUT_CLASS}
            required
            disabled={loadingPartners}
          >
            <option value="">{loadingPartners ? 'Loading business partners…' : 'Select a business partner *'}</option>
            {partners.map((bp) => (
              <option key={bp.id} value={bp.id}>
                {bp.name} ({bp.code})
              </option>
            ))}
          </select>
        )}
      </div>

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
          disabled={isSaving || !tradeGroup.trim() || !businessPartnerId || partners.length === 0}
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
