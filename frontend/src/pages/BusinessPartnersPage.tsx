import { useState } from 'react';
import { Building2, CheckCircle2, Plus, Clock, HardHat } from 'lucide-react';
import { useBusinessPartners } from '../features/business-partners/hooks/useBusinessPartners';
import BusinessPartnerTable from '../features/business-partners/components/BusinessPartnerTable';
import BusinessPartnerCardList from '../features/business-partners/components/BusinessPartnerCardList';
import BusinessPartnerForm from '../features/business-partners/components/BusinessPartnerForm';
import DirectSitePartnerRegisterModal from '../features/business-partners/components/DirectSitePartnerRegisterModal';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
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
    addPartnerDirectly,
    updatePartner,
    deletePartner,
    checkUniqueCode,
    suggestNextCode,
    refresh,
  } = useBusinessPartners();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<BusinessPartner | null>(null);
  const [isDirectRegisterModalOpen, setIsDirectRegisterModalOpen] = useState(false);

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

  const activeOnSiteCount = partners.filter((bp) => bp.isActiveOnSite || (bp.siteWorkerCount && bp.siteWorkerCount > 0)).length;
  const activeCount = partners.filter((bp) => bp.status === 'active').length;
  const pendingCount = partners.filter((bp) => bp.status === 'pending_approval').length;

  return (
    <div className="px-4 md:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 size={20} className="text-blue-700" />
            Business Partners & Subcontractors
          </h1>
          <Breadcrumb items={[{ label: 'Master Data' }, { label: 'Business Partners' }]} className="mt-1" />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="bp-direct-register-btn"
            type="button"
            onClick={() => setIsDirectRegisterModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-700 to-blue-800 text-white font-semibold text-xs rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <Plus size={15} />
            <span>+ Direct Site Register Subcontractor</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-0.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Total Directory
          </span>
          <span className="text-lg font-semibold text-slate-800 tabular-nums">
            {partners.length}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-blue-200/80 bg-blue-50/20 p-3 flex flex-col gap-0.5 shadow-2xs">
          <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wide flex items-center gap-1">
            <HardHat size={12} /> Active on This Site
          </span>
          <span className="text-lg font-semibold text-blue-800 tabular-nums">
            {activeOnSiteCount}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-amber-200 bg-amber-50/30 p-3 flex flex-col gap-0.5 shadow-2xs">
          <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1">
            <Clock size={12} /> Pending HO
          </span>
          <span className="text-lg font-semibold text-amber-800 tabular-nums">
            {pendingCount}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-0.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 size={12} /> Corporate Active
          </span>
          <span className="text-lg font-semibold text-slate-700 tabular-nums">
            {activeCount}
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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200 flex-wrap">
          {[
            { key: 'all', label: 'All Partners' },
            { key: 'active_on_site', label: `Active on Site (${activeOnSiteCount})` },
            { key: 'pending_approval', label: `Pending HO (${pendingCount})` },
            { key: 'active', label: 'Corporate Active' },
            { key: 'inactive', label: 'Inactive' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key as any)}
              className={[
                'px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                statusFilter === key
                  ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {label}
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
          <p className="mt-3 text-xs text-slate-400">
            Showing {filteredPartners.length} of {partners.length} business partners
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

      {/* Direct Site Subcontractor Walk-In Registration Modal */}
      <DirectSitePartnerRegisterModal
        isOpen={isDirectRegisterModalOpen}
        onClose={() => setIsDirectRegisterModalOpen(false)}
        onSuccess={(newPartner) => {
          addPartnerDirectly(newPartner);
          refresh(true);
        }}
      />
    </div>
  );
}
