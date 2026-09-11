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
import StatusBadge from '../../../components/StatusBadge';
import { UserCheck, UserX } from 'lucide-react';

interface EmployeeFormProps {
  /** If provided, form is in edit mode for this employee */
  employee?: Employee | null;
  businessPartners?: BusinessPartner[];
  onSave: (data: EmployeeFormData) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onActivate?: (id: string) => Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function EmployeeForm({
  employee,
  businessPartners,
  onSave,
  onDeactivate,
  onActivate,
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
  const [isStatusChanging, setIsStatusChanging] = useState(false);

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
        status: employee ? employee.status : 'active',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Current Status banner if in edit mode */}
      {employee && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Current Status:</span>
            <StatusBadge status={employee.status} />
          </div>
          <span className="text-xs text-slate-500">
            {employee.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      )}

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
          disabled={isSaving || isStatusChanging || !tradeGroup.trim() || !businessPartnerId || partners.length === 0}
          className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs"
        >
          {isSaving ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
        </button>

        {employee && employee.status === 'active' && onDeactivate && (
          <button
            type="button"
            disabled={isSaving || isStatusChanging}
            onClick={async () => {
              setIsStatusChanging(true);
              try {
                await onDeactivate(employee.id);
              } finally {
                setIsStatusChanging(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium rounded-lg min-h-[48px] px-4 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
          >
            <UserX size={16} className="text-slate-500" />
            <span>{isStatusChanging ? 'Deactivating…' : 'Deactivate employee'}</span>
          </button>
        )}

        {employee && employee.status === 'inactive' && onActivate && (
          <button
            type="button"
            disabled={isSaving || isStatusChanging}
            onClick={async () => {
              setIsStatusChanging(true);
              try {
                await onActivate(employee.id);
              } finally {
                setIsStatusChanging(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 font-medium rounded-lg min-h-[48px] px-4 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
          >
            <UserCheck size={16} className="text-emerald-600" />
            <span>{isStatusChanging ? 'Activating…' : 'Activate employee'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving || isStatusChanging}
          className="w-full text-sm text-slate-500 py-2 transition-colors hover:text-slate-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
