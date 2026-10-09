/**
 * SASettingsPage.tsx — Super Admin: System Configuration
 *
 * Global system settings for the Mäga ERP platform:
 *  - Unit Master (MF_G_UNIT_MASTER): measurement units (Hrs, Days, km, mth, m2)
 *  - Day Types (MF_G_DAY_TYPE): Normal, Poya, Sunday, Special day rate multipliers
 */
import { Settings2, Ruler, CalendarDays } from 'lucide-react';

function ComingSoonCard({ title, icon, description }: {
  title: string;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-violet-100 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A0A2E] to-[#2D1055] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold text-[#C9A84C] bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg w-fit">
        <Settings2 size={10} />
        Full editor coming soon
      </div>
    </div>
  );
}

export default function SASettingsPage() {
  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Settings2 size={20} className="text-[#C9A84C]" />
          <h1 className="text-base font-semibold text-slate-800">System Settings</h1>
        </div>
        <p className="text-xs text-slate-500">Configure global system parameters for all project sites</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComingSoonCard
          title="Unit Master"
          icon={<Ruler size={18} className="text-[#C9A84C]" />}
          description="Manage measurement units used across the platform: Hours (Hrs), Days, Kilometres (km), Month (mth), Square Metres (m²), and more. Each unit can be mapped to IFS/SAP standard codes."
        />
        <ComingSoonCard
          title="Day Types & Rate Multipliers"
          icon={<CalendarDays size={18} className="text-[#C9A84C]" />}
          description="Configure day type categories (Normal, Poya, Sunday, Special) and their overtime rate multipliers. These flow through to payroll calculation and cost reports."
        />
      </div>
    </div>
  );
}
