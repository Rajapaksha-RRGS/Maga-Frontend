/**
 * ActivityCodesPage.tsx — Admin activity code CRUD page.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useActivityCodes } from '../features/activity-codes/hooks/useActivityCodes';
import ActivityCodeTable from '../features/activity-codes/components/ActivityCodeTable';
import ActivityCodeCardList from '../features/activity-codes/components/ActivityCodeCardList';
import ActivityCodeForm from '../features/activity-codes/components/ActivityCodeForm';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import type { ActivityCode } from '../features/activity-codes/services/activityCodeService';

export default function ActivityCodesPage() {
  const { filtered, isLoading, search, setSearch, add, edit, del, checkUnique } = useActivityCodes();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityCode | null>(null);

  const openAdd = () => { setEditing(null); setPanelOpen(true); };
  const openEdit = (c: ActivityCode) => { setEditing(c); setPanelOpen(true); };
  const close = () => { setPanelOpen(false); setEditing(null); };

  const handleSave = async (data: { code: string; description: string }) => {
    if (editing) await edit(editing.id, data); else await add(data);
    close();
  };
  const handleDelete = async (id: string) => { await del(id); close(); };

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-medium text-slate-800">Activity codes</h1>
        <button id="ac-add-btn" onClick={openAdd} className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <Plus size={16} /><span>Add code</span>
        </button>
      </div>
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search codes…" />
      </div>
      {isLoading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && <EmptyState message="No activity codes found." />}
      {!isLoading && filtered.length > 0 && (
        <>
          <ActivityCodeTable data={filtered} onRowClick={openEdit} />
          <ActivityCodeCardList data={filtered} onCardClick={openEdit} />
          <p className="text-xs text-slate-400 mt-3">{filtered.length} code{filtered.length !== 1 ? 's' : ''}</p>
        </>
      )}
      <SlidePanel open={panelOpen} onClose={close} title={editing ? 'Edit activity code' : 'Add activity code'}>
        <ActivityCodeForm activityCode={editing} onSave={handleSave} onDelete={handleDelete} onCancel={close} checkUnique={checkUnique} />
      </SlidePanel>
    </div>
  );
}
