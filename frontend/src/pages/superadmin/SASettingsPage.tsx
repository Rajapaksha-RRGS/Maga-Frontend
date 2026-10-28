/**
 * SASettingsPage.tsx — Super Admin: System Configuration
 *
 * Global master parameters for the Mäga ERP platform:
 *  - Unit Master (MF_G_UNIT_MASTER): measurement units (Hrs, Days, km, mth, m2)
 *  - Day Types (MF_G_DAY_TYPE): Normal, Poya, Sunday, Special day rate multipliers
 *  - System Integration & ERP standard codes
 *
 * Note: Project-level operational settings (like Equipment Pool Assignment Mode)
 * are configured directly by Site Admins within each Site Settings portal (/admin/settings).
 */
import {
  Settings2,
  Ruler,
  CalendarDays,
  ShieldCheck,
  Cpu,
  Layers,
} from 'lucide-react';

function ComingSoonCard({
  title,
  icon,
  description,
}: {
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
        Full master editor coming soon
      </div>
    </div>
  );
}

export default function SASettingsPage() {
  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-6 min-h-0 pb-16">
      {/* ── Page Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Settings2 size={20} className="text-[#C9A84C]" />
          <h1 className="text-base font-semibold text-slate-800">System Master Settings</h1>
        </div>
        <p className="text-xs text-slate-500">
          Global ERP standards, unit masters, and cross-project parameters for Mäga Engineering
        </p>
      </div>

      {/* ── Enterprise Master Parameters ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComingSoonCard
          title="Unit Master (MF_G_UNIT_MASTER)"
          icon={<Ruler size={18} className="text-[#C9A84C]" />}
          description="Manage standard measurement units used across the platform: Hours (Hrs), Days, Kilometres (km), Month (mth), Square Metres (m²), and more. Configured for IFS/SAP standard sync."
        />
        <ComingSoonCard
          title="Day Types & Rate Multipliers (MF_G_DAY_TYPE)"
          icon={<CalendarDays size={18} className="text-[#C9A84C]" />}
          description="Configure company-wide calendar day categories (Normal, Poya, Sunday, Special) and their overtime rate multipliers. These drive automatic payroll calculation and cost reports."
        />
        <ComingSoonCard
          title="ERP & IFS Integration Gateway"
          icon={<Cpu size={18} className="text-[#C9A84C]" />}
          description="Configure API connection credentials, batch synchronization intervals, and schema mapping rules between Mäga Daily Timesheets and IFS Applications."
        />
        <ComingSoonCard
          title="Site Security & Role Policies"
          icon={<ShieldCheck size={18} className="text-[#C9A84C]" />}
          description="Set session timeout rules, password complexity requirements, and multi-factor authentication mandates for Site Admins and Supervisors."
        />
      </div>

      {/* ── Site-Level Settings Notice ── */}
      <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100 flex items-center gap-3 text-xs text-slate-600">
        <Layers size={18} className="text-[#2D1055] flex-shrink-0" />
        <p>
          <strong>Looking for Site Operational Settings?</strong> Machinery pool assignment rules, shift timings, and site-specific dispatch modes are managed directly by Site Admins in their respective <strong>Site Settings</strong> portals.
        </p>
      </div>
    </div>
  );
}
