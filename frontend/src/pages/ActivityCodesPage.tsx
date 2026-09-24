/**
 * ActivityCodesPage.tsx — Admin activity code CRUD page.
 */
import { useState, useMemo } from 'react';
import { Plus, Database } from 'lucide-react';
import { useActivityCodes } from '../features/activity-codes/hooks/useActivityCodes';
import ActivityCodeTable from '../features/activity-codes/components/ActivityCodeTable';
import ActivityCodeCardList from '../features/activity-codes/components/ActivityCodeCardList';
import ActivityCodeForm from '../features/activity-codes/components/ActivityCodeForm';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import MasterImportModal from '../features/master-import/components/MasterImportModal';
import { CORPORATE_ACTIVITY_CATALOG } from '../features/master-import/services/corporateMasterService';
import type { CorporateActivityCode } from '../features/master-import/services/corporateMasterService';
import type { ActivityCode } from '../features/activity-codes/services/activityCodeService';

export default function ActivityCodesPage() {
  const { filtered, isLoading, search, setSearch, add, edit, del, checkUnique } = useActivityCodes();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityCode | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const openAdd = () => { setEditing(null); setPanelOpen(true); };
  const openEdit = (c: ActivityCode) => { setEditing(c); setPanelOpen(true); };
  const close = () => { setPanelOpen(false); setEditing(null); };

  const handleSave = async (data: { code: string; description: string }) => {
    if (editing) await edit(editing.id, data); else await add(data);
    close();
  };
  const handleDelete = async (id: string) => { await del(id); close(); };

  const existingCodes = useMemo(() => {
    return new Set(filtered.map((c) => c.code.toUpperCase()));
  }, [filtered]);

  const handleBatchImport = async (items: CorporateActivityCode[]) => {
    for (const item of items) {
      await add({
        code: item.code,
        description: item.description,
      });
    }
  };

  const activityColumns = [
    {
      key: 'unit',
      header: 'Unit of Measure',
      render: (item: CorporateActivityCode) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {item.unit}
        </span>
      ),
    },
  ];

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Activity Codes Master</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Standard construction activities, BOQ items and tasks for labour tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="ac-import-btn"
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
          >
            <Database size={16} />
            <span>Add from ERP Master</span>
          </button>
          <button
            id="ac-add-btn"
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-3 min-h-[44px] transition-colors hover:bg-slate-50 active:bg-slate-100 cursor-pointer"
            title="Create ad-hoc activity code manually"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Manual entry</span>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search codes…" />
      </div>

      {isLoading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && <EmptyState message="No activity codes found in this project." />}
      {!isLoading && filtered.length > 0 && (
        <>
          <ActivityCodeTable data={filtered} onRowClick={openEdit} />
          <ActivityCodeCardList data={filtered} onCardClick={openEdit} />
          <p className="text-xs text-slate-400 mt-3">{filtered.length} code{filtered.length !== 1 ? 's' : ''}</p>
        </>
      )}

      {/* Corporate ERP Master Import Modal */}
      <MasterImportModal<CorporateActivityCode>
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Corporate ERP Master Catalog — Activity & BOQ Codes"
        subtitle="Search standard CIDA/ICTAD & SSCM construction activity codes and import into this project."
        entityName="Activity Code"
        catalog={CORPORATE_ACTIVITY_CATALOG}
        existingCodes={existingCodes}
        getItemCode={(item) => item.code}
        getItemName={(item) => item.description}
        getItemCategory={(item) => item.tradeGroup}
        getItemSourceProject={(item) => item.sourceProject}
        columns={activityColumns}
        onImport={handleBatchImport}
        onOpenManualAdd={openAdd}
      />

      {/* Manual Slide Panel Form */}
      <SlidePanel open={panelOpen} onClose={close} title={editing ? 'Edit activity code' : 'Add activity code'}>
        <ActivityCodeForm activityCode={editing} onSave={handleSave} onDelete={handleDelete} onCancel={close} checkUnique={checkUnique} />
      </SlidePanel>
    </div>
  );
}
