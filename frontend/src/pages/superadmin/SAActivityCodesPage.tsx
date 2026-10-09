/**
 * SAActivityCodesPage.tsx — Super Admin: Global Activity Code Master
 *
 * Central Corporate IFS / SAP Activity Code Catalog (MF_G_ACTIVITY_CODE).
 * Super Admin manages corporate construction work package codes & standard UOMs.
 * (Note: Per corporate requirements, Project Adoption Status is excluded).
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ListFilter,
  Plus,
  Search,
  Pencil,
  Trash2,
  Layers,
  Ruler,
  AlertCircle,
  X,
  UploadCloud,
} from 'lucide-react';
import api from '../../config/api';
import SACsvImportModal from '../../components/SACsvImportModal';

const ACT_SAMPLE_HEADERS = ['code', 'description', 'unit'];
const ACT_SAMPLE_DATA = [
  { code: '01-10-10-00', description: 'Excavation & Earthwork', unit: 'm3' },
  { code: '01-20-10-00', description: 'Concrete Work - Substructure', unit: 'm3' },
  { code: '02-10-10-00', description: 'Formwork - Superstructure', unit: 'm2' },
  { code: '02-20-10-00', description: 'Rebar & Steel Reinforcement', unit: 'Kg' },
  { code: '00-00-10-00', description: 'General Site Overheads', unit: 'hrs' },
];
const ACT_REQUIRED_FIELDS = ['code', 'description'];

interface CorporateActivityCodeItem {
  id: string;
  code: string;
  description: string;
  unit?: string | null;
  createdAt: string;
}

const COMMON_UNITS = ['m3', 'm2', 'm', 'hrs', 'days', 'Nos', 'Kg', 'Ton', 'L.S', 'km'];

export default function SAActivityCodesPage() {
  const [activityCodes, setActivityCodes] = useState<CorporateActivityCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<CorporateActivityCodeItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUnit, setFormUnit] = useState('m3');

  const fetchActivityCodes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/corporate/activity-codes');
      setActivityCodes(res.data?.items ?? []);
    } catch {
      setError('Failed to fetch corporate activity codes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityCodes();
  }, []);

  // Filtered Activity Codes
  const filtered = useMemo(() => {
    return activityCodes.filter((ac) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        ac.code.toLowerCase().includes(q) ||
        ac.description.toLowerCase().includes(q) ||
        (ac.unit && ac.unit.toLowerCase().includes(q));

      const matchUnit =
        unitFilter === 'all' ||
        (ac.unit ? ac.unit.toLowerCase() === unitFilter.toLowerCase() : unitFilter === 'none');

      return matchSearch && matchUnit;
    });
  }, [activityCodes, search, unitFilter]);

  // Aggregate stats (Simple & relevant, NO Project Adoption Status)
  const totalCount = activityCodes.length;
  const uniqueUnitsCount = new Set(
    activityCodes.map((ac) => ac.unit).filter(Boolean),
  ).size;

  const openAddModal = () => {
    setEditingCode(null);
    setFormCode('');
    setFormDescription('');
    setFormUnit('m3');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (ac: CorporateActivityCodeItem) => {
    setEditingCode(ac);
    setFormCode(ac.code);
    setFormDescription(ac.description);
    setFormUnit(ac.unit || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveActivityCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formDescription.trim()) {
      setFormError('Activity Code and Description are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingCode) {
        // Update
        const res = await api.put(`/corporate/activity-codes/${editingCode.id}`, {
          description: formDescription.trim(),
          unit: formUnit.trim() || null,
        });
        if (res.data?.activityCode) {
          setActivityCodes((prev) =>
            prev.map((c) =>
              c.id === editingCode.id ? { ...c, ...res.data.activityCode } : c,
            ),
          );
        }
      } else {
        // Create
        const res = await api.post('/corporate/activity-codes', {
          code: formCode.trim().toUpperCase(),
          description: formDescription.trim(),
          unit: formUnit.trim() || null,
        });
        if (res.data?.activityCode) {
          setActivityCodes((prev) => [res.data.activityCode, ...prev]);
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivityCode = async (ac: CorporateActivityCodeItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Activity Code ${ac.code} (${ac.description})?`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/corporate/activity-codes/${ac.id}`);
      setActivityCodes((prev) => prev.filter((c) => c.id !== ac.id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete activity code');
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={22} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">
              Corporate Activity Codes Master
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Head Office IFS / SAP Work Breakdown Catalog (MF_G_ACTIVITY_CODE) — Standard construction activities & BOQ items
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Secondary Action: Bulk Import CSV */}
          <button
            id="sa-act-import-csv-btn"
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-800 text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud size={15} className="text-[#C9A84C]" />
            <span>Import CSV</span>
          </button>

          {/* Primary Action Button: Add Activity Code */}
          <button
            id="sa-add-activity-btn"
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Activity Code</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ── KPI Summary Cards (No Project Adoption Status) ────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-violet-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-[#1A0A2E] flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800 tabular-nums">
              {isLoading ? '—' : totalCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Total Activity Codes</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Ruler size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-700 tabular-nums">
              {isLoading ? '—' : uniqueUnitsCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Units of Measure</div>
          </div>
        </div>

        {/* <div className="bg-white rounded-xl border border-emerald-100 p-3.5 shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              Standard
            </div>
            <div className="text-[11px] font-medium text-slate-400">IFS/CIDA Certified</div>
          </div>
        </div> */}
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search activity code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-violet-200 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ListFilter size={14} className="text-slate-400" />
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            >
              <option value="all" className="bg-white text-slate-900">All Units of Measure</option>
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} className="bg-white text-slate-900">
                  {u}
                </option>
              ))}
              <option value="none" className="bg-white text-slate-900">No Unit Specified</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Activity Codes Data Table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] min-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
              <tr className="border-b border-violet-100 bg-violet-50/90">
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Activity Code
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Task / Work Package Description
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Unit of Measure
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-56" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                    <Layers size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No Activity Codes Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {search
                        ? 'Try clearing your search query'
                        : 'Click "Add Activity Code" above to register your first global activity code.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((ac) => (
                  <tr key={ac.id} className="hover:bg-violet-50/30 transition-colors">
                    {/* Activity Code */}
                    <td className="px-4 py-3 font-mono font-bold text-violet-700">
                      <span className="bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                        {ac.code}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{ac.description}</div>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3">
                      {ac.unit ? (
                        <span className="inline-flex items-center font-mono text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                          {ac.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(ac)}
                          title="Edit Activity Code"
                          className="p-1 rounded text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivityCode(ac)}
                          title="Delete Activity Code"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-violet-50 bg-violet-50/30 shrink-0">
            <p className="text-xs text-slate-400">
              {filtered.length} activity code{filtered.length !== 1 ? 's' : ''} in catalog
            </p>
          </div>
        )}
      </div>

      {/* ── Add / Edit Activity Code Modal ────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-violet-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#C9A84C]" />
                <h3 className="font-semibold text-sm">
                  {editingCode ? 'Edit Activity Code' : 'Add Corporate Activity Code'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveActivityCode} className="p-5 flex flex-col gap-4 bg-white text-slate-900">
              {formError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Activity Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingCode}
                  placeholder="e.g. ACT-101, EXC-01, CONC-02"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Work Package / Task Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Earth Excavation for Column Foundations"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* Unit of Measure */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Unit of Measure (UOM)
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. m3, m2, hrs, Nos"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setFormUnit(e.target.value);
                    }}
                    value=""
                    className="px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="" className="bg-white text-slate-900">Presets…</option>
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-white text-slate-900">
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-violet-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    'Saving…'
                  ) : editingCode ? (
                    'Update Activity Code'
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Save Activity Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Universal CSV Import Modal ──────────────────────────────── */}
      <SACsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Import Corporate Activity Codes via CSV"
        entityName="Activity Code"
        endpoint="/corporate/activity-codes/bulk-import"
        sampleHeaders={ACT_SAMPLE_HEADERS}
        sampleData={ACT_SAMPLE_DATA}
        requiredFields={ACT_REQUIRED_FIELDS}
        columnLabels={{
          code: 'Activity / Task Code',
          description: 'Work Package Description',
          unit: 'Unit of Measure (UOM)',
        }}
        onSuccess={() => {
          fetchActivityCodes();
        }}
      />
    </div>
  );
}
