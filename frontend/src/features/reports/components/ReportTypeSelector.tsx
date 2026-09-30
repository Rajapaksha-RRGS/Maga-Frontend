/**
 * ReportTypeSelector.tsx — Segmented tab selector for the 4 report types.
 *
 * Follows design-system.json:
 *   - bg-slate-100 container
 *   - Active tab: bg-white text-blue-700 border border-slate-200 font-medium
 *   - Inactive tab: text-slate-600 hover:text-slate-900
 *   - min-h-[44px], focus-visible:ring-2 ring-blue-600
 */
import type { ReportType, ReportCategory } from '../services/reportService';
import { BarChart3, CalendarRange, Receipt, FileUp, Clock3, FileText, Truck } from 'lucide-react';

interface Props {
  activeTab: ReportType;
  onTabChange: (tab: ReportType) => void;
  category?: ReportCategory | null;
}

interface TabOption {
  id: ReportType;
  label: string;
  icon: React.ReactNode;
  categories?: ReportCategory[];
}

const ALL_TABS: TabOption[] = [
  // Labor Category
  { id: 'time-card',               label: 'Time Card (Official)',      icon: <FileText size={16} />,     categories: ['labor'] },
  { id: 'summary',                 label: 'Attendance Summary',       icon: <BarChart3 size={16} />,     categories: ['labor'] },
  { id: 'day-ot-summary',          label: 'Day & OT Matrix',          icon: <CalendarRange size={16} />, categories: ['labor'] },
  { id: 'bp-bill',                 label: 'BP Subcontractor Bill',    icon: <Receipt size={16} />,       categories: ['labor'] },
  { id: 'erp-upload',              label: 'ERP Upload File',          icon: <FileUp size={16} />,        categories: ['labor'] },
  // Operator Category
  { id: 'running-chart',           label: 'Operator Running Chart',   icon: <Clock3 size={16} />,        categories: ['operator'] },
  { id: 'time-card',               label: 'Operator Time Card',       icon: <FileText size={16} />,     categories: ['operator'] },
  { id: 'bp-bill',                 label: 'BP Subcontractor Bill',    icon: <Receipt size={16} />,       categories: ['operator'] },
  { id: 'summary',                 label: 'Attendance Summary',       icon: <BarChart3 size={16} />,     categories: ['operator'] },
  // Equipment Category
  { id: 'equipment-summary',       label: 'Equipment Entry Sheet',    icon: <FileText size={16} />,     categories: ['equipment'] },
  { id: 'equipment-erp-upload',    label: 'ERP Upload Matrix',        icon: <FileUp size={16} />,        categories: ['equipment'] },
  { id: 'equipment-running-chart', label: 'Equipment Running Chart',  icon: <Truck size={16} />,         categories: ['equipment'] },
];

export default function ReportTypeSelector({ activeTab, onTabChange, category }: Props) {
  const visibleTabs = category 
    ? ALL_TABS.filter((t) => t.categories && t.categories.includes(category))
    : ALL_TABS;

  return (
    <div
      role="tablist"
      aria-label="Report type selection"
      className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-300 rounded-xl shadow-2xs"
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={`${category}-${tab.id}`}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`report-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={[
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[38px]',
              'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none select-none',
              isActive
                ? 'bg-slate-100 text-slate-900 border border-slate-400 shadow-2xs'
                : 'bg-white text-slate-600 border border-transparent hover:border-slate-300 hover:text-slate-900',
            ].join(' ')}
          >
            <span className={isActive ? 'text-slate-900' : 'text-slate-400'}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
