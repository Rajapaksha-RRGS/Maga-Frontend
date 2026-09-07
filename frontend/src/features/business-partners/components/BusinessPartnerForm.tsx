/**
 * BusinessPartnerForm.tsx
 *
 * SlidePanel form for creating and editing Business Partners.
 * Matches styling and UX patterns from EmployeeForm & ActivityCodeForm.
 */
import { useState, useEffect, type FormEvent } from 'react';
import type {
  BusinessPartner,
  BusinessPartnerFormData,
} from '../services/businessPartnerService';
import { Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  partner: BusinessPartner | null;
  onSave: (data: BusinessPartnerFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  checkUniqueCode: (code: string, excludeId?: string) => boolean;
  suggestNextCode?: () => string;
}

export default function BusinessPartnerForm({
  partner,
  onSave,
  onDelete,
  onCancel,
  checkUniqueCode,
  suggestNextCode,
}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [codeError, setCodeError] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (partner) {
      setCode(partner.code);
      setName(partner.name);
      setContactPerson(partner.contactPerson || '');
      setPhone(partner.phone || '');
      setEmail(partner.email || '');
      setAddress(partner.address || '');
      setStatus(partner.status);
    } else {
      const nextCode = suggestNextCode ? suggestNextCode() : 'BP1004094';
      setCode(nextCode);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setStatus('active');
    }
    setCodeError('');
    setNameError('');
    setConfirmDelete(false);
  }, [partner, suggestNextCode]);

  const handleAutoGenerateCode = () => {
    if (suggestNextCode) {
      const generated = suggestNextCode();
      setCode(generated);
      setCodeError('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    let valid = true;
    if (!name.trim()) {
      setNameError('Company name is required');
      valid = false;
    } else {
      setNameError('');
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setCodeError('Partner code is required (e.g. BP1004093)');
      valid = false;
    } else if (!/^BP1\d{6}$/.test(cleanCode)) {
      setCodeError('Code must follow BP1 format: 3 digits prefix (BP1) + 6 running numbers (e.g. BP1004093)');
      valid = false;
    } else if (!checkUniqueCode(cleanCode, partner?.id)) {
      setCodeError('This partner code is already in use');
      valid = false;
    } else {
      setCodeError('');
    }

    if (!valid) return;

    setIsSaving(true);
    try {
      await onSave({
        code: cleanCode,
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        status,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!partner || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(partner.id);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      {/* Code */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">
            Partner Code <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400 font-mono">
            Format: BP1 + 6 digits (e.g. BP1004093)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCodeError('');
              }}
              placeholder="e.g. BP1004093"
              className={[
                'w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border focus:outline-none focus:ring-2 transition-colors tracking-wide',
                codeError
                  ? 'border-red-300 focus:ring-red-400 bg-red-50/20'
                  : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600',
              ].join(' ')}
              maxLength={9}
            />
          </div>

          {!partner && suggestNextCode && (
            <button
              type="button"
              onClick={handleAutoGenerateCode}
              title="Auto-generate next code"
              className="px-2.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              Auto Next
            </button>
          )}
        </div>

        {codeError && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> {codeError}
          </p>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError('');
          }}
          placeholder="e.g. Mäga Engineering (Pvt) Ltd"
          className={[
            'w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors',
            nameError
              ? 'border-red-300 focus:ring-red-400 bg-red-50/20'
              : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600',
          ].join(' ')}
        />
        {nameError && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> {nameError}
          </p>
        )}
      </div>

      {/* Contact Person */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Contact Person / Representative
        </label>
        <input
          type="text"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="e.g. Mr. Kamal Perera"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
        />
      </div>

      {/* Phone & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Phone Number
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94 11 2808835"
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="info@company.lk"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Office / Site Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 200, Nawala Road, Narahenpita, Colombo 05"
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none"
        />
      </div>

      {/* Status Toggle */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Status
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus('active')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            <CheckCircle2 size={13} className={status === 'active' ? 'text-emerald-600' : 'text-slate-400'} />
            Active
          </button>

          <button
            type="button"
            onClick={() => setStatus('inactive')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              status === 'inactive'
                ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-2">
        {partner && onDelete ? (
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 active:bg-blue-900 transition-colors shadow-2xs disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : partner ? 'Save Changes' : 'Create Partner'}
          </button>
        </div>
      </div>
    </form>
  );
}
