/**
 * SAEquipmentPage.tsx — Super Admin: Global Equipment Master
 *
 * Central Corporate Machinery & Equipment Catalog (MF_G_EQUIPMENT).
 * Allows Super Admin to view the entire corporate fleet across all depots and sites,
 * register new equipment, and track current project deployment.
 */
import { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  UploadCloud,
} from 'lucide-react';
import api from '../../config/api';
import SACsvImportModal from '../../components/SACsvImportModal';

const EQ_SAMPLE_HEADERS = [
  'standardEquipmentNumber',
  'equipmentName',
  'condition',
  'unit',
  'minimumUtilization',
  'dailyRate',
  'costRate',
  'vehicleNo',
  'businessPartner',
];
const EQ_SAMPLE_DATA = [
  {
    standardEquipmentNumber: 'MACM0075',
    equipmentName: 'AIR COMPRESSOR INGERSOLL RAND',
    condition: 'DRY',
    unit: 'Hrs',
    minimumUtilization: '0',
    dailyRate: '12000',
    costRate: '12000',
    vehicleNo: 'MACM0075',
    businessPartner: 'BP1002885',
  },
  {
    standardEquipmentNumber: 'MEXC0012',
    equipmentName: 'EXCAVATOR CAT 320D',
    condition: 'DRY',
    unit: 'Hrs',
    minimumUtilization: '125',
    dailyRate: '45000',
    costRate: '45000',
    vehicleNo: 'CAT 320D',
    businessPartner: 'BP1002885',
  },
];
const EQ_REQUIRED_FIELDS = ['standardEquipmentNumber', 'equipmentName'];

interface CorporateEquipmentItem {
  id: string;
  standardEquipmentNumber: string;
  equipmentName: string;
  condition: string;
  unit: string;
  costRate?: number | null;
  dailyRate?: number | null;
  vehicleNo?: string;
  type?: string;
  status: string;
  currentWorkingProject?: string;
}

interface ProjectOption {
  id: string;
  projectCode: string;
  projectName: string;
}

export default function SAEquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<CorporateEquipmentItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formNumber, setFormNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formCondition, setFormCondition] = useState('DRY');
  const [formUnit, setFormUnit] = useState('Hrs');
  const [formCostRate, setFormCostRate] = useState('');
  const [formDailyRate, setFormDailyRate] = useState('');
  const [formVehicleNo, setFormVehicleNo] = useState('');
  const [formType, setFormType] = useState('Heavy Machinery');
  const [formProject, setFormProject] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eqRes, projRes] = await Promise.all([
        api.get('/corporate/equipment'),
        api.get('/tenants'),
      ]);
      setEquipmentList(eqRes.data?.items ?? []);
      setProjects(projRes.data ?? []);
    } catch {
      setError('Failed to load global equipment.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumber.trim()) {
      setFormError('Equipment Number is required');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await api.post('/corporate/equipment', {
        standardEquipmentNumber: formNumber.trim().toUpperCase(),
        equipmentName: formName.trim() || formNumber.trim().toUpperCase(),
        condition: formCondition,
        unit: formUnit,
        costRate: formCostRate.trim() !== '' && !isNaN(parseFloat(formCostRate)) ? parseFloat(formCostRate) : undefined,
        dailyRate: formDailyRate.trim() !== '' && !isNaN(parseFloat(formDailyRate)) ? parseFloat(formDailyRate) : undefined,
        vehicleNo: formVehicleNo.trim() || undefined,
        type: formType || undefined,
        currentWorkingProject: formProject || undefined,
      });
      setIsModalOpen(false);
      setFormNumber('');
      setFormName('');
      setFormVehicleNo('');
      setFormCostRate('');
      setFormDailyRate('');
      setFormProject('');
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create equipment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const types = Array.from(new Set(equipmentList.map((e) => e.type).filter(Boolean))) as string[];

  const filtered = equipmentList.filter((eq) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      eq.standardEquipmentNumber.toLowerCase().includes(q) ||
      eq.equipmentName.toLowerCase().includes(q) ||
      (eq.vehicleNo && eq.vehicleNo.toLowerCase().includes(q));
    const matchType = typeFilter === 'all' || eq.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Wrench size={20} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">Global Equipment Master</h1>
          </div>
          <p className="text-xs text-slate-500">
            Head Office central machinery & plant register
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Secondary Action: Bulk Import CSV */}
          <button
            id="sa-eq-import-csv-btn"
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-800 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud size={14} className="text-[#C9A84C]" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsModalOpen(true);
              setFormError('');
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Global Equipment</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Code, Name, or Vehicle No…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          />
        </div>
        {types.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-violet-200 rounded-lg bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-slate-700"
          >
            <option value="all">All Equipment Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[380px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
              <tr className="border-b border-violet-100 bg-violet-50/90">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Equip Code / Reg</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type / Condition</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost Rate (LKR)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Location</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-28" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-36" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-12" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-12" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    No corporate equipment found.
                  </td>
                </tr>
              ) : (
                filtered.map((eq) => (
                  <tr key={eq.id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold">
                          {eq.standardEquipmentNumber}
                        </span>
                        {eq.vehicleNo && (
                          <span className="font-mono text-[11px] text-slate-400">
                            {eq.vehicleNo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{eq.equipmentName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <span>{eq.type || 'General Plant'}</span>
                      <span className="ml-2 font-mono text-[10px] bg-slate-100 border border-slate-200 px-1 py-0.2 rounded text-slate-600">
                        {eq.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-slate-600">
                      {eq.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-slate-700 tabular-nums">
                      {eq.costRate != null ? Number(eq.costRate).toLocaleString('en-LK', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {eq.currentWorkingProject ? (
                        <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                          <Building2 size={11} /> {eq.currentWorkingProject}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Central Yard
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {eq.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
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
              {filtered.length} equipment unit{filtered.length !== 1 ? 's' : ''} in fleet
            </p>
          </div>
        )}
      </div>

      {/* ── Add Global Equipment Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 max-h-[90vh] overflow-y-auto text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">Add Global Equipment (MF_G_EQUIPMENT)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Register a machine or vehicle in the central Head Office fleet.
            </p>

            {formError && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateEquipment} className="space-y-3.5 bg-white text-slate-900">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Equipment Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. MEXC0015"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle / Reg No</label>
                  <input
                    type="text"
                    placeholder="e.g. WP-SP-4821"
                    value={formVehicleNo}
                    onChange={(e) => setFormVehicleNo(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Equipment Name / Model *</label>
                <input
                  type="text"
                  placeholder="e.g. CAT 320D Hydraulic Excavator"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  >
                    <option value="Heavy Machinery" className="bg-white text-slate-900">Heavy Machinery</option>
                    <option value="Earthmoving" className="bg-white text-slate-900">Earthmoving</option>
                    <option value="Compaction" className="bg-white text-slate-900">Compaction</option>
                    <option value="Transport" className="bg-white text-slate-900">Transport</option>
                    <option value="Concrete" className="bg-white text-slate-900">Concrete</option>
                    <option value="Crane" className="bg-white text-slate-900">Crane</option>
                    <option value="Power" className="bg-white text-slate-900">Power/Generator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Condition</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  >
                    <option value="DRY" className="bg-white text-slate-900">DRY (No Fuel)</option>
                    <option value="WET" className="bg-white text-slate-900">WET (With Fuel)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Meter Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  >
                    <option value="Hrs" className="bg-white text-slate-900">Hrs</option>
                    <option value="km" className="bg-white text-slate-900">km</option>
                    <option value="Days" className="bg-white text-slate-900">Days</option>
                    <option value="mth" className="bg-white text-slate-900">mth</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cost Rate (LKR) — Optional</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15000 (Optional)"
                    value={formCostRate}
                    onChange={(e) => setFormCostRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Daily / Base Rate (LKR) — Optional</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 20000 (Optional)"
                    value={formDailyRate}
                    onChange={(e) => setFormDailyRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Current Location / Deployment (Optional)
                </label>
                <select
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                >
                  <option value="" className="bg-white text-slate-900">Central Equipment Yard / Depot</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.projectCode} className="bg-white text-slate-900">
                      {proj.projectCode} - {proj.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering…' : 'Register Equipment'}
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
        title="Import Corporate Equipment via CSV"
        entityName="Equipment"
        endpoint="/corporate/equipment/bulk-import"
        sampleHeaders={EQ_SAMPLE_HEADERS}
        sampleData={EQ_SAMPLE_DATA}
        requiredFields={EQ_REQUIRED_FIELDS}
        columnLabels={{
          standardEquipmentNumber: 'Standard Equipment Number',
          equipmentName: 'Equipment Name / Model',
          condition: 'Condition (DRY / WET)',
          unit: 'Meter Unit (Hrs, km, Days)',
          minimumUtilization: 'Min Utilization',
          dailyRate: 'Daily Rate (LKR)',
          costRate: 'Cost Rate (LKR)',
          vehicleNo: 'Vehicle / Registration No',
          businessPartner: 'Business Partner Code',
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
