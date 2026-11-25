import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Search,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import api from '../config/api';

interface ProjectTradeRateItem {
  tradeGroupId: string;
  tradeGroupCode: string;
  tradeGroupName: string;
  internalSkilledRate: number;
  internalUnskilledRate: number;
  foreignSkilledRate: number;
  foreignUnskilledRate: number;
  supplySkilledRate: number;
  supplyUnskilledRate: number;
  subcontractorSkilledRate: number;
  subcontractorUnskilledRate: number;
}

interface ProjectInfo {
  id: string;
  projectCode: string;
  projectName: string;
  currency?: string;
}

const RATE_FIELDS: { key: keyof ProjectTradeRateItem; label: string }[] = [
  { key: 'internalSkilledRate', label: 'Skilled' },
  { key: 'internalUnskilledRate', label: 'Unskilled' },
  { key: 'foreignSkilledRate', label: 'Skilled' },
  { key: 'foreignUnskilledRate', label: 'Unskilled' },
  { key: 'supplySkilledRate', label: 'Skilled' },
  { key: 'supplyUnskilledRate', label: 'Unskilled' },
  { key: 'subcontractorSkilledRate', label: 'Skilled' },
  { key: 'subcontractorUnskilledRate', label: 'Unskilled' },
];

export default function PriceModelPage() {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [items, setItems] = useState<ProjectTradeRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const loadRates = async () => {
    setLoading(true);
    setError('');
    setSavedMsg('');
    try {
      const res = await api.get('/employees/trade-rates');
      setProject(res.data?.project || null);
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load project trade rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.tradeGroupCode.toLowerCase().includes(q) ||
        it.tradeGroupName.toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleRateChange = (
    tradeGroupId: string,
    field: keyof ProjectTradeRateItem,
    raw: string
  ) => {
    const val = raw === '' ? 0 : Math.max(0, Number(raw) || 0);
    setItems((prev) =>
      prev.map((it) => (it.tradeGroupId === tradeGroupId ? { ...it, [field]: val } : it))
    );
    setSavedMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await api.put('/employees/trade-rates', { rates: items });
      setSavedMsg('Price model rates saved successfully.');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save trade rates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 max-w-[1600px] mx-auto">
      <Breadcrumb items={[{ label: 'Price Model' }]} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <DollarSign size={18} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Price Model {project ? `— ${project.projectCode}` : ''}
              </h1>
              <p className="text-xs text-slate-500">
                Configure project-level daily rates ({project?.currency || 'LKR'}) per Trade Group, Worker Origin, and Skill Level
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRates}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? 'Saving...' : 'Save Rates'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {savedMsg && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg">
          <CheckCircle2 size={15} />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Search & Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search trade code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            Showing {filtered.length} of {items.length} trade groups
          </span>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              Loading project trade rates...
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    rowSpan={2}
                    className="px-4 py-2.5 text-left font-semibold text-slate-600 border-r border-slate-200 min-w-[200px]"
                  >
                    Trade Group
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-1.5 text-center font-semibold text-emerald-800 bg-emerald-50/80 border-r border-slate-200"
                  >
                    Internal
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-1.5 text-center font-semibold text-blue-800 bg-blue-50/80 border-r border-slate-200"
                  >
                    Foreign
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-1.5 text-center font-semibold text-amber-800 bg-amber-50/80 border-r border-slate-200"
                  >
                    Supply Labor
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-1.5 text-center font-semibold text-purple-800 bg-purple-50/80"
                  >
                    Subcontractor
                  </th>
                </tr>
                <tr className="border-t border-slate-200">
                  {RATE_FIELDS.map((f, idx) => (
                    <th
                      key={f.key}
                      className={`px-2 py-1.5 text-center font-medium text-slate-600 min-w-[100px] ${
                        idx % 2 === 1 && idx < RATE_FIELDS.length - 1
                          ? 'border-r border-slate-200'
                          : ''
                      }`}
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No trade groups found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.tradeGroupId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {item.tradeGroupCode}
                          </span>
                          <span className="font-medium text-slate-800 truncate">
                            {item.tradeGroupName}
                          </span>
                        </div>
                      </td>
                      {RATE_FIELDS.map((f, idx) => (
                        <td
                          key={f.key}
                          className={`px-2 py-1.5 ${
                            idx % 2 === 1 && idx < RATE_FIELDS.length - 1
                              ? 'border-r border-slate-200'
                              : ''
                          }`}
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number(item[f.key] ?? 0)}
                            onChange={(e) =>
                              handleRateChange(item.tradeGroupId, f.key, e.target.value)
                            }
                            className="w-full px-2 py-1.5 text-right text-xs border border-slate-200 rounded-md bg-white text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
