import { 
  Home, 
  Users, 
  HardHat, 
  Tractor, 
  ClipboardCheck 
} from 'lucide-react';

export type SupervisorTabKey = 'dashboard' | 'labor' | 'operators' | 'equipment' | 'summary';

interface SupervisorBottomNavProps {
  activeTab: SupervisorTabKey;
  onTabChange: (tab: SupervisorTabKey) => void;
  badgeCounts?: {
    laborPending?: number;
    operatorPending?: number;
    equipmentPending?: number;
  };
}

export function SupervisorBottomNav({
  activeTab,
  onTabChange,
  badgeCounts = {},
}: SupervisorBottomNavProps) {
  const tabs = [
    {
      key: 'dashboard' as const,
      label: 'Home',
      icon: Home,
      badge: undefined,
    },
    {
      key: 'labor' as const,
      label: 'Labor',
      icon: Users,
      badge: badgeCounts.laborPending && badgeCounts.laborPending > 0 ? badgeCounts.laborPending : undefined,
    },
    {
      key: 'operators' as const,
      label: 'Operators',
      icon: HardHat,
      badge: badgeCounts.operatorPending && badgeCounts.operatorPending > 0 ? badgeCounts.operatorPending : undefined,
    },
    {
      key: 'equipment' as const,
      label: 'Equipment',
      icon: Tractor,
      badge: badgeCounts.equipmentPending && badgeCounts.equipmentPending > 0 ? badgeCounts.equipmentPending : undefined,
    },
    {
      key: 'summary' as const,
      label: 'Summary',
      icon: ClipboardCheck,
      badge: undefined,
    },
  ];

  return (
    <nav
      aria-label="Supervisor Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors shadow-lg"
    >
      <div className="max-w-md mx-auto px-1 flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[48px] rounded-xl transition-all',
                isActive
                  ? 'text-blue-700 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              ].join(' ')}
            >
              {/* Active Indicator bar */}
              {isActive && (
                <span className="absolute -top-2 w-8 h-1 bg-blue-700 dark:bg-blue-400 rounded-full" />
              )}

              {/* Icon with Optional Badge */}
              <div className="relative">
                <Icon size={21} className={isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] tracking-tight mt-1 leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
