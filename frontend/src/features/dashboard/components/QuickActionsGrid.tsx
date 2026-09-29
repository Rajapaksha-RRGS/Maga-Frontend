/**
 * QuickActionsGrid.tsx
 *
 * 6 shortcut cards for the most commonly used admin pages.
 * Emerald primary, blue secondary.
 */
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Cog,
  Truck,
  CheckCircle2,
  BarChart3,
  Users,
  ArrowRight,
} from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: 'Labour assign',
    description: 'Assign employees to supervisors',
    to: '/admin/assignments/labour',
    icon: <ClipboardList size={20} />,
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-50 group-hover:bg-emerald-100',
  },
  {
    label: 'Operator assign',
    description: 'Assign operators to equipment',
    to: '/admin/assignments/operator',
    icon: <Cog size={20} />,
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50 group-hover:bg-blue-100',
  },
  {
    label: 'Equipment assign',
    description: 'Schedule equipment for today',
    to: '/admin/assignments/equipment',
    icon: <Truck size={20} />,
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-50 group-hover:bg-indigo-100',
  },
  {
    label: 'Approvals',
    description: 'Review and approve daily sheets',
    to: '/admin/approvals',
    icon: <CheckCircle2 size={20} />,
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-50 group-hover:bg-emerald-100',
  },
  {
    label: 'Reports',
    description: 'Export payroll & ERP reports',
    to: '/admin/reports',
    icon: <BarChart3 size={20} />,
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50 group-hover:bg-blue-100',
  },
  {
    label: 'Employee master',
    description: 'Manage employee records',
    to: '/admin/employees',
    icon: <Users size={20} />,
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-50 group-hover:bg-indigo-100',
  },
];

export default function QuickActionsGrid() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-800">Quick actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50 hover:bg-white"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${action.accentBg} ${action.accent}`}>
              {action.icon}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{action.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{action.description}</p>
            </div>
            <ArrowRight
              size={13}
              className={`${action.accent} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
