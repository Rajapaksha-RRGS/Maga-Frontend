/**
 * TenantsPage.tsx — Multi-Tenant Administration & Registration Portal
 *
 * Provides platform administrators with the tools to register tenant companies,
 * auto-generate and manage their primary Admin credentials, toggle active/suspended
 * state, and review cross-tenant usage metrics.
 *
 * Implements design-system.json:
 * - Blue-700 primary buttons
 * - Semantic green success banners with 1-click clipboard copy
 * - Responsive desktop table + mobile card list
 */
import { useState } from 'react';
import { Plus, Copy, CheckCircle2, Building2 } from 'lucide-react';
import { useTenants } from '../features/tenants/hooks/useTenants';
import type {
  TenantRecord,
  TenantRegisterInput,
  TenantUpdateInput,
} from '../features/tenants/services/tenantService';
import TenantStats from '../features/tenants/components/TenantStats';
import TenantTable from '../features/tenants/components/TenantTable';
import TenantCardList from '../features/tenants/components/TenantCardList';
import TenantForm from '../features/tenants/components/TenantForm';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';

export default function TenantsPage() {
  const {
    filtered,
    stats,
    isLoading,
    isSubmitting,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    tempPasswordResult,
    clearTempPassword,
    register,
    update,
    toggleStatus,
    resetAdminPassword,
  } = useTenants();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const openAdd = () => {
    setEditingTenant(null);
    clearTempPassword();
    setPanelOpen(true);
  };

  const openEdit = (tenant: TenantRecord) => {
    setEditingTenant(tenant);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingTenant(null);
  };

  const handleSaveRegister = async (data: TenantRegisterInput) => {
    return await register(data);
  };

  const handleSaveUpdate = async (id: string, data: TenantUpdateInput) => {
    return await update(id, data);
  };

  const handleCopyPassword = async () => {
    if (tempPasswordResult) {
      await navigator.clipboard.writeText(tempPasswordResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-blue-700" />
            <h1 className="text-base font-medium text-slate-800">
              Tenants & Organizations
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Register new tenant companies and manage their initial admin login accounts.
          </p>
        </div>

        <button
          id="btn-register-tenant"
          onClick={openAdd}
          className="flex items-center justify-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 flex-shrink-0"
        >
          <Plus size={16} />
          <span>Register tenant</span>
        </button>
      </div>

      {/* ── Temporary Password Notification Banner ─────────────── */}
      {tempPasswordResult && (
        <div className="flex items-start sm:items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">
              Initial credentials generated for {tempPasswordResult.name}:
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {tempPasswordResult.username && (
                <span className="text-xs font-mono text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-green-200">
                  User: <strong>{tempPasswordResult.username}</strong>
                </span>
              )}
              <span className="text-xs font-mono text-green-800 bg-white/80 px-2 py-0.5 rounded border border-green-200 font-medium">
                Pass: <strong>{tempPasswordResult.password}</strong>
              </span>
              <span className="text-[11px] text-green-700">
                (Copy and share securely with the organization admin)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopyPassword}
              title="Copy password to clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-green-300 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[36px]"
            >
              {copied ? (
                <>
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy password</span>
                </>
              )}
            </button>
            <button
              onClick={clearTempPassword}
              className="text-xs text-green-700 hover:text-green-900 hover:underline px-1 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <TenantStats stats={stats} />

      {/* ── Search & Filter Controls ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by company, subdomain, or admin…"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 self-start sm:self-auto">
          {(['all', 'active', 'suspended'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors min-h-[32px] ${
                statusFilter === filterKey
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {filterKey}
            </button>
          ))}
        </div>
      </div>

      {/* ── Data Views (Table for desktop, Cards for mobile) ───── */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          Loading tenant records…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No tenant organizations match your query." />
      ) : (
        <>
          <TenantTable
            tenants={filtered}
            onEdit={openEdit}
            onResetPassword={resetAdminPassword}
            onToggleStatus={toggleStatus}
          />
          <TenantCardList
            tenants={filtered}
            onEdit={openEdit}
            onResetPassword={resetAdminPassword}
            onToggleStatus={toggleStatus}
          />
        </>
      )}

      {/* ── SlidePanel Pop-up Form ──────────────────────────────── */}
      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
        title={editingTenant ? 'Edit Tenant Information' : 'Register New Tenant & Admin'}
      >
        <TenantForm
          initialTenant={editingTenant}
          isSubmitting={isSubmitting}
          onSaveRegister={handleSaveRegister}
          onSaveUpdate={handleSaveUpdate}
          onClose={closePanel}
        />
      </SlidePanel>
    </div>
  );
}
