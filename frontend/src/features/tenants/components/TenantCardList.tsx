/**
 * TenantCardList.tsx
 *
 * Mobile-friendly card list representation for Multi-Tenant organizations.
 * Follows design-system.json:
 * - min-h-[44px] touch targets
 * - rounded-lg cards
 * - High contrast status indicators
 */
import { KeyRound, Edit2, ShieldAlert, ShieldCheck, Building2, User } from 'lucide-react';
import type { TenantRecord } from '../services/tenantService';

interface TenantCardListProps {
  tenants: TenantRecord[];
  onEdit: (tenant: TenantRecord) => void;
  onResetPassword: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: 'active' | 'suspended') => void;
}

export default function TenantCardList({
  tenants,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: TenantCardListProps) {
  return (
    <div className="md:hidden flex flex-col gap-3">
      {tenants.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-3"
        >
          {/* Header row: Company name & Status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 text-sm truncate">
                {t.subdomain} - {t.companyName}
              </h2>
              {t.addressLine1 && (
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {t.addressLine1}
                </p>
              )}
            </div>

            {t.status === 'active' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Suspended
              </span>
            )}
          </div>

          {/* Details row: Admin & Contact */}
          <div className="bg-slate-50 rounded-md p-2.5 flex flex-col gap-1.5 text-xs text-slate-600">
            {t.primaryAdmin && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium text-slate-800">{t.primaryAdmin.fullName}</span>
                <span className="font-mono text-slate-500">(@{t.primaryAdmin.username})</span>
              </div>
            )}
            {t.email && (
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{t.email}</span>
                {t.phone && <span className="text-slate-400">• {t.phone}</span>}
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            {t.primaryAdmin && (
              <button
                onClick={() => onResetPassword(t.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors min-h-[44px]"
              >
                <KeyRound size={14} />
                <span>Reset password</span>
              </button>
            )}

            <button
              onClick={() => onEdit(t)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors min-h-[44px]"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>

            <button
              onClick={() => onToggleStatus(t.id, t.status)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors min-h-[44px] ${
                t.status === 'active'
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {t.status === 'active' ? (
                <>
                  <ShieldAlert size={14} />
                  <span>Suspend</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Activate</span>
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
