import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  HardHat, 
  Tractor, 
  Calendar,
  Search,
  Filter,
  Layers,
  FileText
} from 'lucide-react';
import { TimeCardDocument } from './TimeCardDocument';
import { getTimeCardReport, type TimeCardResponse, type TimeCardItem } from '../services/reportService';

interface TimeCardReportViewProps {
  initialMonth?: string;
  businessPartners?: string[];
  defaultWorkerType?: 'all' | 'labor' | 'operator';
}

export const TimeCardReportView: React.FC<TimeCardReportViewProps> = ({
  initialMonth = new Date().toISOString().slice(0, 7),
  businessPartners = [],
  defaultWorkerType = 'all',
}) => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [workerType, setWorkerType] = useState<'all' | 'labor' | 'operator'>(defaultWorkerType);
  const [selectedBp, setSelectedBp] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    if (defaultWorkerType) {
      setWorkerType(defaultWorkerType);
    }
  }, [defaultWorkerType]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimeCardResponse | null>(null);

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
  const filteredCards = cards.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.employeeCode.toLowerCase().includes(q) ||
      c.callingName.toLowerCase().includes(q) ||
      c.fullName.toLowerCase().includes(q) ||
      c.trade.toLowerCase().includes(q)
    );
  });

  const activeCard: TimeCardItem | undefined = filteredCards[currentIndex];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ── Filter & Control Bar (Hidden during Print) ── */}
      <div className="print:hidden p-4 rounded-xl bg-white border border-slate-300 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Worker Type Toggle (Labour vs Operator vs All) */}
          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-300 rounded-xl">
            <button
              type="button"
              onClick={() => setWorkerType('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                workerType === 'all'
                  ? 'bg-white text-slate-900 border border-slate-400 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Users size={14} className={workerType === 'all' ? 'text-slate-900' : 'text-slate-400'} />
              <span>All ({cards.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkerType('labor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                workerType === 'labor'
                  ? 'bg-white text-slate-900 border border-slate-400 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              <HardHat size={14} className={workerType === 'labor' ? 'text-slate-900' : 'text-slate-400'} />
              <span>Laborers</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkerType('operator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                workerType === 'operator'
                  ? 'bg-white text-slate-900 border border-slate-400 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Tractor size={14} className={workerType === 'operator' ? 'text-slate-900' : 'text-slate-400'} />
              <span>Operators</span>
            </button>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Calendar size={14} className="text-slate-600" />
              <span>Month:</span>
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={filteredCards.length === 0}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={14} className="text-slate-600" />
            <span>Print Official Time Card</span>
          </button>
        </div>

        {/* ── Second Row: Search & Subcontractor filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Emp Code, Name, or Trade..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentIndex(0);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Business Partner filter if provided */}
          {businessPartners.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-slate-400" />
              <select
                value={selectedBp}
                onChange={(e) => setSelectedBp(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">All Contractors (Direct & Sub)</option>
                {businessPartners.map((bp) => (
                  <option key={bp} value={bp}>{bp}</option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Toggle: Single Card Pagination vs View All */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewAll(!viewAll)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                viewAll
                  ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Layers size={13} />
              <span>{viewAll ? 'Showing All Cards' : 'Browse One by One'}</span>
            </button>

            {/* Pagination Controls when in Single Card mode */}
            {!viewAll && filteredCards.length > 1 && (
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                  title="Previous Worker"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 font-semibold text-slate-700">
                  {currentIndex + 1} / {filteredCards.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === filteredCards.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(filteredCards.length - 1, prev + 1))}
                  className="p-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30"
                  title="Next Worker"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Document Display Area ── */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Generating official Maga Time Cards...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Time Cards Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            No work logs recorded for the selected month or worker filter.
          </p>
        </div>
      ) : viewAll ? (
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
      )}
    </div>
  );
};
