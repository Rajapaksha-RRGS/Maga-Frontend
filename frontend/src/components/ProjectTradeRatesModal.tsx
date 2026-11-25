import { useEffect, useMemo, useState } from 'react';
import { X, Search, Save, Loader2, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../config/api';

export interface ProjectTradeRateItem {
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

interface ProjectTradeRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: { id: string; projectCode: string; projectName: string; currency?: string } | null;
}

const RATE_FIELDS: { key: keyof ProjectTradeRateItem; label: string; group: string }[] = [
  { key: 'internalSkilledRate', label: 'Skilled', group: 'Internal' },
  { key: 'internalUnskilledRate', label: 'Unskilled', group: 'Internal' },
  { key: 'foreignSkilledRate', label: 'Skilled', group: 'Foreign' },
  { key: 'foreignUnskilledRate', label: 'Unskilled', group: 'Foreign' },
  { key: 'supplySkilledRate', label: 'Skilled', group: 'Supply' },
  { key: 'supplyUnskilledRate', label: 'Unskilled', group: 'Supply' },
  { key: 'subcontractorSkilledRate', label: 'Skilled', group: 'Subcontractor' },
  { key: 'subcontractorUnskilledRate', label: 'Unskilled', group: 'Subcontractor' },
];

export default function ProjectTradeRatesModal({
  isOpen,
  onClose,
  project,
}: ProjectTradeRatesModalProps) {
  const [items, setItems] = useState<ProjectTradeRateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !project?.id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setSavedMsg('');
    api
      .get(`/corporate/projects/${project.id}/trade-rates`)
      .then((res) => {
        if (!cancelled) {
          setItems(res.data?.items || []);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load project trade rates');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, project?.id]);

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
    if (!project?.id) return;
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await api.put(`/corporate/projects/${project.id}/trade-rates`, { rates: items });
      setSavedMsg('Project trade rates saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save trade rates');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sa-modal"
      style={{ colorScheme: 'light' }}
    >
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-violet-100 text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between gap-4 bg-violet-50/40 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-[#C9A84C]" />
              <h2 className="text-base font-bold text-slate-900">
                Project Trade Rates — {project.projectCode} ({project.projectName})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure daily rates ({project.currency || 'LKR'}) per Trade Group, Worker Origin, and Skill Level
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search trade code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                <AlertCircle size={13} /> {error}
              </span>
            )}
            {savedMsg && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <CheckCircle2 size={13} /> {savedMsg}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-violet-600" />
              Loading project trade rates...
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-violet-50 border-b border-violet-200">
                <tr>
                  <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-slate-600 border-r border-violet-100 min-w-[180px]">
                    Trade Group
                  </th>
                  <th colSpan={2} className="px-2 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/80 border-r border-violet-100">
                    Internal
                  </th>
                  <th colSpan={2} className="px-2 py-1.5 text-center font-bold text-blue-800 bg-blue-50/80 border-r border-violet-100">
                    Foreign
                  </th>
                  <th colSpan={2} className="px-2 py-1.5 text-center font-bold text-amber-800 bg-amber-50/80 border-r border-violet-100">
                    Supply Labor
                  </th>
                  <th colSpan={2} className="px-2 py-1.5 text-center font-bold text-purple-800 bg-purple-50/80">
                    Subcontractor
                  </th>
                </tr>
                <tr className="border-t border-violet-100">
                  {RATE_FIELDS.map((f, idx) => (
                    <th
                      key={f.key}
                      className={`px-2 py-1.5 text-center font-medium text-slate-600 min-w-[96px] ${
                        idx % 2 === 1 && idx < RATE_FIELDS.length - 1 ? 'border-r border-violet-100' : ''
                      }`}
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.tradeGroupId} className="hover:bg-violet-50/20">
                    <td className="px-3 py-2 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                          {item.tradeGroupCode}
                        </span>
                        <span className="font-medium text-slate-800 truncate">{item.tradeGroupName}</span>
                      </div>
                    </td>
                    {RATE_FIELDS.map((f, idx) => (
                      <td
                        key={f.key}
                        className={`px-1.5 py-1.5 ${
                          idx % 2 === 1 && idx < RATE_FIELDS.length - 1 ? 'border-r border-slate-100' : ''
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
                          className="w-full px-2 py-1 text-right text-xs border border-slate-200 rounded bg-white text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">{filtered.length} trade groups</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? 'Saving...' : 'Save Rates'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
