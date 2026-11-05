/**
 * SATradeGroupsPage.tsx — Super Admin: Trade Group Configuration
 *
 * Manage corporate trade categories (MF_G_TRADE_GROUP).
 * Trade groups define the job role of each worker (Mason, Driver, Helper, Operator, etc.)
 * and their standard daily rate used across all project sites and BP billing.
 *
 * Supports multi-currency trade designations (LKR, USD, INR) for local & expat labor.
 * NOTE: OT rate is strictly a derived/calculated attribute: (Daily Rate / 8) * 1.5.
 * It is not stored or managed as a separate column.
 */
import { useState, useEffect } from 'react';
import {
  Plus,
  HardHat,
  Pencil,
  Search,
  CheckCircle2,
  XCircle,
  UploadCloud,
} from 'lucide-react';
import api from '../../config/api';
import SACsvImportModal from '../../components/SACsvImportModal';

const TG_SAMPLE_HEADERS = ['code', 'name', 'currency', 'standardDailyRate'];
const TG_SAMPLE_DATA = [
  { code: 'MMS', name: 'Mason (Local)', currency: 'LKR', standardDailyRate: '2000.00' },
  { code: 'USD-MMS', name: 'USD - Mason', currency: 'USD', standardDailyRate: '20.00' },
  { code: 'INR-MMS', name: 'INR - Mason', currency: 'INR', standardDailyRate: '1500.00' },
  { code: 'ASP', name: 'Asphalt Laying', currency: 'LKR', standardDailyRate: '800.00' },
  { code: 'MAL', name: 'Aluminium Fabricator', currency: 'LKR', standardDailyRate: '880.00' },
  { code: 'MBB', name: 'Bar Bender', currency: 'LKR', standardDailyRate: '880.00' },
  { code: 'MDR', name: 'Driver', currency: 'LKR', standardDailyRate: '680.00' },
  { code: 'MEX', name: 'Excavator Operator', currency: 'LKR', standardDailyRate: '1200.00' },
];
const TG_REQUIRED_FIELDS = ['code', 'name', 'standardDailyRate'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface TradeGroup {
  id: string;
  code: string;
  name: string;
  currency?: string;
  standardDailyRate: number;
  status: string;
  createdAt: string;
}

// ── Currency Helpers ──────────────────────────────────────────────────────────
export function formatRateWithCurrency(rate: number, currency: string = 'LKR'): string {
  const num = Number(rate || 0);
  switch (currency?.toUpperCase()) {
    case 'USD':
      return `$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'INR':
      return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'LKR':
    default:
      return `LKR ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function CurrencyBadge({ currency = 'LKR' }: { currency?: string }) {
  const cur = (currency || 'LKR').toUpperCase();
  if (cur === 'USD') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
        USD ($)
      </span>
    );
  }
  if (cur === 'INR') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
        INR (₹)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
      LKR
    </span>
  );
}

// ── Skeleton Row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-8" /></td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SATradeGroupsPage() {
  const [tradeGroups, setTradeGroups] = useState<TradeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setIsLoading(true);
      try {
        const res = await api.get('/corporate/trade-groups');
        if (!cancelled) setTradeGroups(res.data?.items ?? res.data ?? []);
      } catch {
        if (!cancelled) setError('Failed to load trade groups.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  const filtered = tradeGroups.filter(
    (tg) =>
      tg.name.toLowerCase().includes(search.toLowerCase()) ||
      tg.code.toLowerCase().includes(search.toLowerCase()) ||
      (tg.currency || 'LKR').toLowerCase().includes(search.toLowerCase()),
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTradeGroup, setEditingTradeGroup] = useState<TradeGroup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCurrency, setFormCurrency] = useState('LKR');
  const [formDailyRate, setFormDailyRate] = useState('2000');
  const [formError, setFormError] = useState('');

  const handleSaveTradeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Code and Name are required');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      const dailyVal = parseFloat(formDailyRate) || (formCurrency === 'USD' ? 20 : 2000);

      if (editingTradeGroup) {
        const res = await api.put(`/corporate/trade-groups/${editingTradeGroup.id}`, {
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          currency: formCurrency,
          standardDailyRate: dailyVal,
        });
        if (res.data?.tradeGroup) {
          setTradeGroups((prev) =>
            prev.map((t) => (t.id === editingTradeGroup.id ? res.data.tradeGroup : t))
          );
          setIsModalOpen(false);
          setEditingTradeGroup(null);
        }
      } else {
        const res = await api.post('/corporate/trade-groups', {
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          currency: formCurrency,
          standardDailyRate: dailyVal,
        });
        if (res.data?.tradeGroup) {
          setTradeGroups((prev) => [res.data.tradeGroup, ...prev]);
          setIsModalOpen(false);
          setFormCode('');
          setFormName('');
          setFormCurrency('LKR');
          setFormDailyRate('2000');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save trade group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <HardHat size={20} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">Trade Groups</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate job categories and their standard daily rates (LKR, USD, INR)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Secondary Action: Bulk Import CSV */}
          <button
            id="sa-tg-import-csv-btn"
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-800 text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud size={14} className="text-[#C9A84C]" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingTradeGroup(null);
              setFormCode('');
              setFormName('');
              setFormDailyRate('2000');
              setFormCurrency('LKR');
              setFormError('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            <span>Add trade group</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search trade groups or currencies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-violet-200 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder:text-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[380px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
              <tr className="border-b border-violet-100 bg-violet-50/90">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Trade Designation</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {isLoading
                ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      No trade groups found.
                    </td>
                  </tr>
                )
                : filtered.map((tg) => {
                    const daily = Number(tg.standardDailyRate || 1400);

                    return (
                      <tr key={tg.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold">
                              {tg.code}
                            </span>
                            <CurrencyBadge currency={tg.currency} />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{tg.name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                          {formatRateWithCurrency(daily, tg.currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tg.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTradeGroup(tg);
                              setFormCode(tg.code);
                              setFormName(tg.name);
                              setFormCurrency(tg.currency || 'LKR');
                              setFormDailyRate(String(Number(tg.standardDailyRate) || 0));
                              setFormError('');
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                            aria-label={`Edit ${tg.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-violet-50 bg-violet-50/30 shrink-0">
            <p className="text-xs text-slate-400">{filtered.length} trade group{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* ── Add Trade Group Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-violet-100 text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">
              {editingTradeGroup ? 'Edit Global Trade Group' : 'Add Global Trade Group'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {editingTradeGroup
                ? 'Update trade group code, designation, and standard daily rate.'
                : 'Define a standard trade designation, currency, and daily rate.'}
            </p>

            {formError && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTradeGroup} className="space-y-3.5 bg-white text-slate-900">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Trade Code *</label>
                <input
                  type="text"
                  placeholder="e.g. MMS, USD-MMS, INR-MMS, DRIVER"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Trade Name / Designation *</label>
                <input
                  type="text"
                  placeholder="e.g. Mason (Local), USD - Mason, Expat Mason"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Currency *</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => {
                      const c = e.target.value;
                      setFormCurrency(c);
                      if (c === 'USD') setFormDailyRate('20.00');
                      else if (c === 'INR') setFormDailyRate('1500.00');
                      else setFormDailyRate('2000.00');
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  >
                    <option value="LKR">LKR (Rs.)</option>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Daily Rate ({formCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={formCurrency === 'USD' ? 'e.g. 20.00' : 'e.g. 2000.00'}
                    value={formDailyRate}
                    onChange={(e) => setFormDailyRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
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
                  {isSubmitting ? 'Saving…' : editingTradeGroup ? 'Update Trade Group' : 'Create Trade Group'}
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
        title="Import Corporate Trade Groups via CSV"
        entityName="Trade Group"
        endpoint="/corporate/trade-groups/bulk-import"
        sampleHeaders={TG_SAMPLE_HEADERS}
        sampleData={TG_SAMPLE_DATA}
        requiredFields={TG_REQUIRED_FIELDS}
        columnLabels={{
          code: 'Trade Group Code',
          name: 'Trade Name / Designation',
          currency: 'Currency (LKR / USD / INR)',
          standardDailyRate: 'Daily Rate',
        }}
        onSuccess={() => {
          api.get('/corporate/trade-groups').then((res) => {
            setTradeGroups(res.data?.items ?? res.data ?? []);
          });
        }}
      />
    </div>
  );
}
