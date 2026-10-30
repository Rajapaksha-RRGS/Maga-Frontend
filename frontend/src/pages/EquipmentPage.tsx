/**
 * EquipmentPage.tsx — Admin equipment CRUD page.
 * Assembles feature components only — no business logic (per spec).
 */
import { useState, useMemo } from 'react';
import { Database } from 'lucide-react';
import { useEquipment } from '../features/equipment/hooks/useEquipment';
import EquipmentTable from '../features/equipment/components/EquipmentTable';
import EquipmentCardList from '../features/equipment/components/EquipmentCardList';
import EquipmentImportView from '../features/equipment/components/EquipmentImportView';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import type { CorporateEquipment } from '../features/master-import/services/corporateMasterService';

export default function EquipmentPage() {
  const { filtered, isLoading, search, setSearch, batchImport } = useEquipment();
  const [showImport, setShowImport] = useState(false);

  const existingCodes = useMemo(() => {
    return new Set(filtered.map((e) => e.code.toUpperCase()));
  }, [filtered]);

  const handleBatchImport = async (items: CorporateEquipment[]) => {
    try {
      await batchImport(
        items.map((item) => ({
          code: item.code,
          name: item.name,
          type: item.type,
          costRate: item.costRate !== undefined && item.costRate !== null ? Number(item.costRate) : 0,
          primaryUnit: item.primaryUnit || item.unit || 'Hrs',
          availableUnits: Array.isArray(item.availableUnits) && item.availableUnits.length > 0
            ? item.availableUnits
            : [item.unit || item.primaryUnit || 'Hrs'],
        }))
      );
      setShowImport(false);
    } catch (err: any) {
      console.error('Batch import failed:', err);
      alert(err.message || 'Failed to import equipment');
    }
  };

  // ── Full-screen import view ──────────────────────────────────────────────────
  if (showImport) {
    return (
      <div className="h-full max-h-full flex-1 flex flex-col min-h-0 overflow-hidden box-border overscroll-none">
        <EquipmentImportView
          onBack={() => setShowImport(false)}
          existingCodes={existingCodes}
          onImport={handleBatchImport}
        />
      </div>
    );
  }

  // ── Normal page ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Equipment Master</h1>
          <Breadcrumb items={[{ label: 'Master Data' }, { label: 'Equipment Master' }]} className="mt-1" />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="equip-import-btn"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
          >
            <Database size={16} />
            <span>Add from ERP Master</span>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search equipment…" />
      </div>

      {isLoading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && <EmptyState message="No equipment found in this project." />}
      {!isLoading && filtered.length > 0 && (
        <>
          <EquipmentTable data={filtered} />
          <EquipmentCardList data={filtered} />
          <p className="text-xs text-slate-400 mt-3">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
        </>
      )}
    </div>
  );
}
