import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  HardHat, 
  Cog, 
  Truck, 
  Calendar, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import AssignmentsPage from './AssignmentsPage';
import OperatorAssignmentsPage from './OperatorAssignmentsPage';
import EquipmentAssignmentsPage from './EquipmentAssignmentsPage';

export type AssignmentTabKey = 'labour' | 'operator' | 'equipment';

interface AssignmentsHubPageProps {
  defaultTab?: AssignmentTabKey;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[dt.getUTCDay()];
}

const TABS: Array<{
  key: AssignmentTabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  path: string;
  activeColor: string;
}> = [
  {
    key: 'labour',
    label: 'Labour assign',
    icon: HardHat,
    path: '/admin/assignments/labour',
    activeColor: 'text-emerald-600',
  },
  {
    key: 'operator',
    label: 'Operator assign',
    icon: Cog,
    path: '/admin/assignments/operator',
    activeColor: 'text-blue-600',
  },
  {
    key: 'equipment',
    label: 'Equipment assign',
    icon: Truck,
    path: '/admin/assignments/equipment',
    activeColor: 'text-amber-600',
  },
];

export default function AssignmentsHubPage({ defaultTab = 'labour' }: AssignmentsHubPageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Resolve active tab from URL path
  const currentPath = location.pathname.toLowerCase();
  const activeTab: AssignmentTabKey = currentPath.includes('/operator')
    ? 'operator'
    : currentPath.includes('/equipment')
    ? 'equipment'
    : 'labour';

  // Persistent date across tabs
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const urlParams = new URLSearchParams(location.search);
    const dateParam = urlParams.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return sessionStorage.getItem('maga_assignment_date') || getTodayStr();
  });

  // Store in sessionStorage whenever date changes
  useEffect(() => {
    sessionStorage.setItem('maga_assignment_date', selectedDate);
  }, [selectedDate]);

  const isToday = selectedDate === getTodayStr();

  const handleTabClick = (tabKey: AssignmentTabKey) => {
    const target = TABS.find((t) => t.key === tabKey);
    if (target) {
      navigate(target.path);
    }
  };

  const currentTabMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="bg-[#F7F8FA] min-h-full px-4 md:px-6 py-5">
      {/* ── Top Header: Title, Breadcrumbs & Common Date Controller ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 shadow-2xs">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-800">
                Resource Assignments
              </h1>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                {currentTabMeta.label}
              </span>
            </div>
            <Breadcrumb
              items={[
                { label: 'Assignments', to: '/admin/assignments/labour' },
                { label: currentTabMeta.label },
              ]}
              className="mt-0.5"
            />
          </div>
        </div>

        {/* ── Crisp, Clean Date Selector (Matches Site Style) ── */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
            <Calendar size={15} className="text-blue-600 flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer font-mono"
            />
            <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
              {getDayName(selectedDate)}
            </span>
            {isToday && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={17} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="Jump to Today"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── Modern Tabs Navigation ── */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon size={16} className={isActive ? tab.activeColor : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active Tab Content ── */}
      <div>
        {activeTab === 'labour' && (
          <AssignmentsPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            hideHeader={true}
          />
        )}
        {activeTab === 'operator' && (
          <OperatorAssignmentsPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            hideHeader={true}
          />
        )}
        {activeTab === 'equipment' && (
          <EquipmentAssignmentsPage
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            hideHeader={true}
          />
        )}
      </div>
    </div>
  );
}
