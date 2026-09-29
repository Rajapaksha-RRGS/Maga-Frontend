/**
 * BusinessPartnersPage.tsx — Admin Business Partners CRUD page.
 *
 * Follows design-system.json & dev-system-spec patterns.
 */
import { useState, useMemo } from 'react';
import { Building2, CheckCircle2, XCircle, Database } from 'lucide-react';
import { useBusinessPartners } from '../features/business-partners/hooks/useBusinessPartners';
import BusinessPartnerTable from '../features/business-partners/components/BusinessPartnerTable';
import BusinessPartnerCardList from '../features/business-partners/components/BusinessPartnerCardList';
import BusinessPartnerForm from '../features/business-partners/components/BusinessPartnerForm';
import BusinessPartnerErpMasterView from '../features/business-partners/components/BusinessPartnerErpMasterView';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import type { CorporateBusinessPartner } from '../features/master-import/services/corporateMasterService';
import type {
  BusinessPartner,
  BusinessPartnerFormData,
} from '../features/business-partners/services/businessPartnerService';

export default function BusinessPartnersPage() {
  const {
    partners,
    filteredPartners,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    addPartner,
    updatePartner,
    deletePartner,
    checkUniqueCode,
    suggestNextCode,
  } = useBusinessPartners();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'erp-master'>('list');

  const existingCodes = useMemo(() => {
    return new Set(partners.map((p) => p.code.toUpperCase()));
  }, [partners]);

  const handleBatchImport = async (items: CorporateBusinessPartner[]) => {
    for (const item of items) {
      await addPartner({
        code: item.code,
        name: item.name,
        contactPerson: item.contactPerson,
        phone: item.phone,
        email: item.email,
        address: item.address,
      });
    }
  };

  const openEdit = (partner: BusinessPartner) => {
    setEditingPartner(partner);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingPartner(null);
  };

  const handleSave = async (data: BusinessPartnerFormData) => {
    if (editingPartner) {
      await updatePartner(editingPartner.id, data);
    } else {
      await addPartner(data);
    }
    closePanel();
  };

  const handleDelete = async (id: string) => {
    await deletePartner(id);
    closePanel();
  };

  const activeCount = partners.filter((bp) => bp.status === 'active').length;
  const inactiveCount = partners.filter((bp) => bp.status === 'inactive').length;

  return (
    <div className="px-4 md:px-6 py-5">
      {viewMode === 'erp-master' ? (
        /* ── ERP Master Studio Directory View (Inline on Page) ─────────────── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <Database size={20} className="text-blue-700 dark:text-blue-400" />
                Corporate ERP Master Directory — Business Partners
              </h1>
              <Breadcrumb
                items={[
                  { label: 'Master Data' },
                  { label: 'Business Partners', onClick: () => setViewMode('list') },
                  { label: 'Add from ERP Master' },
                ]}
                className="mt-1"
              />
            </div>
          </div>

          <BusinessPartnerErpMasterView
            existingCodes={existingCodes}
            onImport={handleBatchImport}
            onClose={() => setViewMode('list')}
          />
        </div>
      ) : (
        /* ── Regular Project Business Partners View ────────────────────────── */
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 size={20} className="text-blue-700" />
                Business partners
              </h1>
              <Breadcrumb items={[{ label: 'Master Data' }, { label: 'Business Partners' }]} className="mt-1" />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="bp-import-btn"
                onClick={() => setViewMode('erp-master')}
                className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
              >
                <Database size={16} />
                <span>Add from ERP Master</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-0.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Total Partners
              </span>
              <span className="text-lg font-semibold text-slate-800 tabular-nums">
                {partners.length}
              </span>
            </div>

            <div className="bg-white rounded-lg border border-emerald-200/80 bg-emerald-50/20 p-3 flex flex-col gap-0.5 shadow-2xs">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 size={12} /> Active
              </span>
              <span className="text-lg font-semibold text-emerald-800 tabular-nums">
                {activeCount}
              </span>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-0.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <XCircle size={12} /> Inactive
              </span>
              <span className="text-lg font-semibold text-slate-700 tabular-nums">
                {inactiveCount}
              </span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search partners by name, code, contact person..."
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200">
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={[
                    'px-3 py-1 text-xs font-medium rounded-md capitalize transition-all',
                    statusFilter === s
                      ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table / Cards / Empty State */}
          {isLoading && (
            <div className="py-12 text-center text-sm text-slate-400">
              Loading business partners…
            </div>
          )}

          {!isLoading && filteredPartners.length === 0 && (
            <EmptyState message="No business partners found matching your filters." />
          )}

          {!isLoading && filteredPartners.length > 0 && (
            <>
              <BusinessPartnerTable
                data={filteredPartners}
                onRowClick={openEdit}
              />
              <BusinessPartnerCardList
                data={filteredPartners}
                onCardClick={openEdit}
              />
              <p className="text-xs text-slate-400 mt-3">
                Showing {filteredPartners.length} of {partners.length} partner
                {partners.length !== 1 ? 's' : ''}
              </p>
            </>
          )}

          {/* SlidePanel for Add / Edit */}
          <SlidePanel
            open={panelOpen}
            onClose={closePanel}
            title={editingPartner ? 'Edit business partner' : 'Add business partner'}
          >
            <BusinessPartnerForm
              partner={editingPartner}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancel={closePanel}
              checkUniqueCode={checkUniqueCode}
              suggestNextCode={suggestNextCode}
            />
          </SlidePanel>
        </>
      )}
    </div>
  );
}
