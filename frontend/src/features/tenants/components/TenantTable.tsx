/**
 * TenantTable.tsx
 *
 * Desktop tabular view for Multi-Tenant organizations and initial admin accounts.
 * Follows design-system.json:
 * - Interactive elements min-h-[44px]
 * - Focus rings ring-blue-600
 * - Semantic badges: green-50 / green-700 for active, amber-50 / amber-700 for suspended
 */
import { KeyRound, Edit2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { TenantRecord } from '../services/tenantService';

interface TenantTableProps {
  tenants: TenantRecord[];
  onEdit: (tenant: TenantRecord) => void;
  onResetPassword: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: 'active' | 'suspended') => void;
}

export default function TenantTable({
  tenants,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: TenantTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left border-collapse" aria-label="Tenant Organizations">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-xs font-medium uppercase tracking-wide">
            <th className="py-3 px-4">Organization & Subdomain</th>
            <th className="py-3 px-4">Primary Admin</th>
            <th className="py-3 px-4">Contact Info</th>
            <th className="py-3 px-4">Users</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {tenants.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
              {/* Company & Subdomain */}
              <td className="py-3 px-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-800">{t.companyName}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {t.subdomain}
                    </span>
                    <span className="text-xs text-slate-400">
                      .{window.location.hostname}
                    </span>
                  </div>
                </div>
              </td>

              {/* Primary Admin */}
              <td className="py-3 px-4">
                {t.primaryAdmin ? (
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800">
                      {t.primaryAdmin.fullName}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      @{t.primaryAdmin.username}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">No admin user</span>
                )}
              </td>

              {/* Contact Info */}
              <td className="py-3 px-4 text-xs text-slate-600">
                <div className="flex flex-col gap-0.5">
                  {t.email ? (
                    <span className="truncate max-w-[200px]" title={t.email}>
                      {t.email}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {t.phone && <span className="text-slate-500">{t.phone}</span>}
                </div>
              </td>

              {/* Users count */}
              <td className="py-3 px-4">
                <span className="inline-flex items-center justify-center font-medium text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {t.userCount ?? 1} {t.userCount === 1 ? 'user' : 'users'}
                </span>
              </td>

              {/* Status Badge */}
              <td className="py-3 px-4">
                {t.status === 'active' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Suspended
                  </span>
                )}
              </td>

              {/* Actions */}
              <td className="py-3 px-4 text-right">
                <div className="inline-flex items-center gap-1">
                  {/* Reset Admin Password */}
                  {t.primaryAdmin && (
                    <button
                      onClick={() => onResetPassword(t.id)}
                      title="Reset Admin Password"
                      className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                    >
                      <KeyRound size={16} />
                    </button>
                  )}

                  {/* Edit details */}
                  <button
                    onClick={() => onEdit(t)}
                    title="Edit Tenant Information"
                    className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                  >
                    <Edit2 size={16} />
                  </button>

                  {/* Toggle Active / Suspended */}
                  <button
                    onClick={() => onToggleStatus(t.id, t.status)}
                    title={t.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                    className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                      t.status === 'active'
                        ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {t.status === 'active' ? (
                      <ShieldAlert size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
