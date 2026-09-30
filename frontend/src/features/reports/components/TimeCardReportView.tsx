/**
 * TimeCardReportView.tsx — Interactive Table & Official Time Card Studio.
 *
 * Implements:
 *   - Screen Real Estate & Readability: Clean, high-density Interactive Table View by default
 *   - Consistency Across All Reports: Matches BpBillTable & SummaryTable design language
 *   - Comprehensive Payroll Columns: Emp Code, Name, Trade, Contractor, Rate, Days, OT, Gross, Deductions, Net Pay
 *   - Quick-Access "View Card" Modal: Inspect 31-day daily In/Out grid & physical print sheet on demand
 *   - Excel Export: Downloads official Maga formatted Time Card & Wage workbook
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Calendar,
  Search,
  Filter,
  Layers,
  FileText,
  Users,
  Clock,
  DollarSign,
  Eye,
  X,
  Building2
} from 'lucide-react';
import { TimeCardDocument } from './TimeCardDocument';
import { 
  getTimeCardReport, 
  exportTimeCardToExcel, 
  type TimeCardResponse, 
  type TimeCardItem 
} from '../services/reportService';
import { useAuth } from '../../../context/AuthContext';
import { getTenantById } from '../../auth/services/authService';

interface TimeCardReportViewProps {
  initialMonth?: string;
  businessPartners?: string[];
  defaultWorkerType?: 'all' | 'labor' | 'operator';
}

function formatLKR(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const TimeCardReportView: React.FC<TimeCardReportViewProps> = ({
  initialMonth = new Date().toISOString().slice(0, 7),
  businessPartners = [],
  defaultWorkerType = 'all',
}) => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [workerType, setWorkerType] = useState<'all' | 'labor' | 'operator'>(defaultWorkerType);
  const [selectedBp, setSelectedBp] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View mode: 'table' (default modern table) vs 'card' (paper document view)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewAllCards, setViewAllCards] = useState(false);
  
  // Modal for viewing individual official card from table view
  const [selectedModalCard, setSelectedModalCard] = useState<TimeCardItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<TimeCardResponse | null>(null);

  useEffect(() => {
    if (defaultWorkerType) {
      setWorkerType(defaultWorkerType);
    }
  }, [defaultWorkerType]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getTimeCardReport({
      month: selectedMonth,
      workerType: workerType,
      businessPartner: selectedBp || undefined,
    }).then((res) => {
      if (isMounted) {
        setData(res);
        setCurrentIndex(0);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, workerType, selectedBp]);

  const cards = data?.cards || [];

  // Filter cards by search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const q = searchQuery.toLowerCase();
    return cards.filter((c) => (
      c.employeeCode.toLowerCase().includes(q) ||
      c.callingName.toLowerCase().includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      c.trade.toLowerCase().includes(q) ||
      c.businessPartner.toLowerCase().includes(q)
    ));
  }, [cards, searchQuery]);

  // Aggregate KPI Totals
  const totals = useMemo(() => {
    let totalDays = 0;
    let totalOtHours = 0;
    let grossPay = 0;
    let deductions = 0;
    let netPay = 0;

    for (const c of filteredCards) {
      totalDays += c.totals?.totalDays || 0;
      totalOtHours += c.totals?.totalOtHours || 0;
      grossPay += c.totals?.grossPay || 0;
      deductions += c.totals?.deductions?.total || 0;
      netPay += c.totals?.netPay || 0;
    }

    return {
      workerCount: filteredCards.length,
      totalDays,
      totalOtHours,
      grossPay,
      deductions,
      netPay,
    };
  }, [filteredCards]);

  const activeCard: TimeCardItem | undefined = filteredCards[currentIndex];

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      const tenantId = user?.tenantId || 'tenant-001';
      const tenant = await getTenantById(tenantId);
      const preparedBy = user?.fullName || 'Site Accountant / Time Keeper';
      await exportTimeCardToExcel(
        { ...data, cards: filteredCards },
        tenant || undefined,
        preparedBy,
        `Time_Card_Report_${selectedMonth}_${workerType}.xlsx`
      );
    } catch (err) {
      console.error('Failed to export Time Card report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI Metric Summary Cards (Consistent with BpBill & RunningChart) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" /> Active Workers
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.workerCount} <span className="text-xs font-normal text-slate-400">{workerType}s</span>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-500" /> Total Days
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalDays.toFixed(1)} <span className="text-xs font-normal text-slate-400">days</span>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" /> Total OT Hours
          </span>
          <span className="text-xl font-semibold text-amber-900 tabular-nums">
            {totals.totalOtHours.toFixed(1)} <span className="text-xs font-normal text-slate-400">hrs</span>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <DollarSign size={14} className="text-slate-500" /> Gross Earnings
          </span>
          <span className="text-lg font-semibold text-slate-800 tabular-nums">
            LKR {formatLKR(totals.grossPay)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-emerald-200/90 bg-emerald-50/30 p-3.5 flex flex-col gap-1 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
            <DollarSign size={14} className="text-emerald-600" /> Net Payable
          </span>
          <span className="text-lg font-bold text-emerald-950 tabular-nums">
            LKR {formatLKR(totals.netPay)}
          </span>
        </div>
      </div>

      {/* ── Filter Bar & Actions Toolbar (Print Hidden) ── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Left Controls: Month & Search */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Month Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Calendar size={13} className="text-slate-500" />
                <span>Month:</span>
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Emp, Name, Trade..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentIndex(0);
                }}
                className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Subcontractor Filter */}
            {businessPartners.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-slate-400" />
                <select
                  value={selectedBp}
                  onChange={(e) => setSelectedBp(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
                >
                  <option value="">All Contractors</option>
                  {businessPartners.map((bp) => (
                    <option key={bp} value={bp}>{bp}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Controls: View Mode Toggle & Exports */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Table View vs Official Card Carousel */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={[
                  'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1',
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <Layers size={13} />
                <span>Table View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={[
                  'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1',
                  viewMode === 'card'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <FileText size={13} />
                <span>Card View</span>
              </button>
            </div>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || filteredCards.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
            >
              <Download size={13} className="text-emerald-700" />
              <span>{isExporting ? 'Exporting…' : 'Export Excel'}</span>
            </button>

            {/* Print Official Sheet Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredCards.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
            >
              <Printer size={13} className="text-slate-600" />
              <span>Print Official</span>
            </button>
          </div>
        </div>

        {/* Carousel pagination bar when in Card View */}
        {viewMode === 'card' && !viewAllCards && filteredCards.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              Viewing Worker <strong>{currentIndex + 1}</strong> of <strong>{filteredCards.length}</strong>: <span className="text-slate-800 font-semibold">{activeCard?.fullName}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewAllCards(true)}
                className="text-xs text-blue-700 hover:underline font-medium"
              >
                View All Stacked
              </button>

              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-2 font-semibold text-slate-700">
                  {currentIndex + 1} / {filteredCards.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === filteredCards.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(filteredCards.length - 1, prev + 1))}
                  className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'card' && viewAllCards && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              Showing All <strong>{filteredCards.length}</strong> Time Cards (Stacked Print Mode)
            </span>
            <button
              type="button"
              onClick={() => setViewAllCards(false)}
              className="text-xs text-blue-700 hover:underline font-medium"
            >
              Back to Single Card Browse
            </button>
          </div>
        )}
      </div>

      {/* ── Content View Area ── */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-600 font-medium">Compiling Time Card records & wages...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No Time Cards Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            No work logs recorded for the selected month or filter.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ── INTERACTIVE TABLE VIEW (Matches BpBillTable & RunningChart) ── */
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-blue-100 text-blue-800 rounded-md">
                <FileText size={14} />
              </span>
              <h2 className="font-semibold text-slate-800 text-xs sm:text-sm">
                {workerType === 'operator' ? 'Operator Time Cards & Wages' : 'Labor Time Cards & Wages'}
              </h2>
              <span className="text-xs text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-medium">
                {filteredCards.length} records
              </span>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Month: <strong className="text-slate-800">{data?.monthLabel || selectedMonth}</strong>
            </span>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-xs text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="px-3.5 py-3 whitespace-nowrap">Emp Code</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Worker Name</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Trade / Designation</th>
                  <th className="px-3.5 py-3 whitespace-nowrap">Contractor / BP</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Daily Rate</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Days</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">OT Hours</th>
                  <th className="px-3.5 py-3 text-right whitespace-nowrap">Gross Pay</th>
                  <th className="px-3.5 py-3 text-right whitespace-nowrap">Deductions</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Net Payable</th>
                  <th className="px-3.5 py-3 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCards.map((c) => (
                  <tr key={c.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Emp Code */}
                    <td className="px-3.5 py-2.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      {c.employeeCode}
                    </td>

                    {/* Name */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{c.fullName}</div>
                      {c.callingName && (
                        <div className="text-[10px] text-slate-400 font-medium">({c.callingName})</div>
                      )}
                    </td>

                    {/* Trade */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {c.trade || 'General'}
                      </span>
                    </td>

                    {/* Business Partner */}
                    <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400" />
                        <span>{c.businessPartner || 'Direct'}</span>
                      </span>
                    </td>

                    {/* Daily Rate */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {c.dailyRate > 0 ? formatLKR(c.dailyRate) : '—'}
                    </td>

                    {/* Days */}
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {c.totals.totalDays.toFixed(1)}
                    </td>

                    {/* OT Hours */}
                    <td className="px-3 py-2.5 text-right font-mono text-amber-800 tabular-nums whitespace-nowrap">
                      {c.totals.totalOtHours > 0 ? c.totals.totalOtHours.toFixed(1) : '—'}
                    </td>

                    {/* Gross Pay */}
                    <td className="px-3.5 py-2.5 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                      {c.totals.grossPay > 0 ? formatLKR(c.totals.grossPay) : '—'}
                    </td>

                    {/* Deductions */}
                    <td className="px-3.5 py-2.5 text-right font-mono text-rose-700 tabular-nums whitespace-nowrap">
                      {c.totals.deductions?.total > 0 ? `-${formatLKR(c.totals.deductions.total)}` : '—'}
                    </td>

                    {/* Net Payable */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-950 tabular-nums whitespace-nowrap bg-emerald-50/30">
                      {c.totals.netPay > 0 ? formatLKR(c.totals.netPay) : '—'}
                    </td>

                    {/* Action: View Card */}
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedModalCard(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Eye size={12} />
                        <span>View Card</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Grand Totals Footer Row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                  <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wide text-slate-900">
                    Grand Total ({filteredCards.length} Workers):
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {totals.totalDays.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-amber-900 tabular-nums">
                    {totals.totalOtHours.toFixed(1)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatLKR(totals.grossPay)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-rose-800 tabular-nums">
                    {totals.deductions > 0 ? `-${formatLKR(totals.deductions)}` : '0.00'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-950 tabular-nums bg-emerald-50/50">
                    LKR {formatLKR(totals.netPay)}
                  </td>
                  <td className="px-3.5 py-3 text-center text-slate-400">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ── OFFICIAL PAPER CARD CAROUSEL VIEW ── */
        viewAllCards ? (
          <div className="space-y-8">
            {filteredCards.map((c) => (
              <div key={c.employeeId} className="print:break-after-page">
                <TimeCardDocument card={c} />
              </div>
            ))}
          </div>
        ) : (
          activeCard && (
            <div>
              <TimeCardDocument card={activeCard} />
            </div>
          )
        )
      )}

      {/* ── Individual Official Card Overlay Modal ── */}
      {selectedModalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-700" />
                <h3 className="font-bold text-sm text-slate-800">
                  Official Time Card — {selectedModalCard.fullName} ({selectedModalCard.employeeCode})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Print Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModalCard(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body with Time Card Document */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-65px)] bg-slate-100/50">
              <TimeCardDocument card={selectedModalCard} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
