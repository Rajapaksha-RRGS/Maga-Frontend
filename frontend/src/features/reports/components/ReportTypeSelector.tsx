/**
 * ReportTypeSelector.tsx — Segmented tab selector for the 4 report types.
 *
 * Follows design-system.json:
 *   - bg-slate-100 container
 *   - Active tab: bg-white text-blue-700 border border-slate-200 font-medium
 *   - Inactive tab: text-slate-600 hover:text-slate-900
 *   - min-h-[44px], focus-visible:ring-2 ring-blue-600
 */
import type { ReportType } from '../services/reportService';
import { BarChart3, CalendarRange, Receipt, FileUp } from 'lucide-react';

interface Props {
  activeTab: ReportType;
  onTabChange: (tab: ReportType) => void;
}

interface TabOption {
  id: ReportType;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabOption[] = [
  { id: 'summary',        label: 'Summary',            icon: <BarChart3 size={16} /> },
  { id: 'day-ot-summary', label: 'Day & OT Summary',   icon: <CalendarRange size={16} /> },
  { id: 'bp-bill',        label: 'BP Bill',            icon: <Receipt size={16} /> },
  { id: 'erp-upload',     label: 'ERP Upload Export',  icon: <FileUp size={16} /> },
];

export default function ReportTypeSelector({ activeTab, onTabChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Report type selection"
      className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200/90 rounded-xl"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`report-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={[
              'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px]',
              'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none select-none',
              isActive
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-medium'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 font-normal',
            ].join(' ')}
          >
            <span className={isActive ? 'text-blue-700' : 'text-slate-500'}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
