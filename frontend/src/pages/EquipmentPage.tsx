/**
 * EquipmentPage.tsx — Admin equipment CRUD page.
 * Assembles feature components only — no business logic (per spec).
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useEquipment } from '../features/equipment/hooks/useEquipment';
import EquipmentTable from '../features/equipment/components/EquipmentTable';
import EquipmentCardList from '../features/equipment/components/EquipmentCardList';
import EquipmentForm from '../features/equipment/components/EquipmentForm';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import type { Equipment, EquipmentFormData } from '../features/equipment/services/equipmentService';

export default function EquipmentPage() {
  const { filtered, isLoading, search, setSearch, add, edit, remove } = useEquipment();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const openAdd = () => { setEditing(null); setPanelOpen(true); };
  const openEdit = (e: Equipment) => { setEditing(e); setPanelOpen(true); };
  const close = () => { setPanelOpen(false); setEditing(null); };

  const handleSave = async (data: EquipmentFormData) => {
    if (editing) await edit(editing.id, data); else await add(data);
    close();
  };
  const handleDeactivate = async (id: string) => { await remove(id); close(); };

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-medium text-slate-800">Equipment</h1>
        <button id="equip-add-btn" onClick={openAdd} className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <Plus size={16} /><span>Add equipment</span>
        </button>
      </div>
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search equipment…" />
      </div>
      {isLoading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && <EmptyState message="No equipment found." />}
      {!isLoading && filtered.length > 0 && (
        <>
          <EquipmentTable data={filtered} onRowClick={openEdit} />
          <EquipmentCardList data={filtered} onCardClick={openEdit} />
          <p className="text-xs text-slate-400 mt-3">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
        </>
      )}
      <SlidePanel open={panelOpen} onClose={close} title={editing ? 'Edit equipment' : 'Add equipment'}>
        <EquipmentForm equipment={editing} onSave={handleSave} onDeactivate={handleDeactivate} onCancel={close} />
      </SlidePanel>
    </div>
  );
}
