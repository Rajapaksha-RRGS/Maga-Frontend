/**
 * ReportsHubOverview.tsx — 3D Stacked Cards Hub for Maga Reports.
 *
 * Implements the exact 3-card layered deck aesthetic shown in the user's design reference:
 *   1. Labor & Workforce Reports (Emerald/Teal 3D stacked deck)
 *   2. Operator & Machinery Drivers (Deep Purple/Indigo 3D stacked deck)
 *   3. Equipment & Plant Fleet (Vibrant Sunset Orange/Amber 3D stacked deck)
 *
 * Features:
 *   - Stacked rounded tabs on top giving physical card-deck depth
 *   - Circular translucent icon badges
 *   - High-contrast, elegant typography
 *   - Key capability highlights & live stats summary
 *   - Smooth hover micro-animations & click-through to category workspace
 */
import React from 'react';
import { 
  Users, 
  HardHat, 
  Truck, 
  ArrowRight, 
  Sparkles,
  Layers,
  CheckCircle2,
  CalendarCheck2,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import type { ReportCategory, ReportsHubStats } from '../services/reportService';

interface Props {
  onSelectCategory: (category: ReportCategory) => void;
  stats?: ReportsHubStats | null;
  isLoadingStats?: boolean;
}

export const ReportsHubOverview: React.FC<Props> = ({ 
  onSelectCategory, 
  stats,
  isLoadingStats = false 
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 px-1 flex flex-col gap-8 sm:gap-10">
      {/* ── Top Header Section (Matching Design Inspiration) ── */}
      <div className="flex flex-col items-start gap-2.5 max-w-3xl">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/80 shadow-2xs">
          <Sparkles size={13} className="text-orange-600" />
          <span>Operational Overview</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Build a <span className="text-orange-600">Studio</span> That Actually Works
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
          Three specialized operational reporting systems engineered to streamline site attendance, heavy plant utilization, and official Maga Engineering payroll exports.
        </p>
      </div>

      {/* ── 3D Stacked Cards Grid (Matching Visual Layout in Uploaded Photo) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-6 pt-4 pb-6">
        
        {/* ── CARD 1: Labor & Workforce Reports (Emerald / Teal) ── */}
        <div 
          onClick={() => onSelectCategory('labor')}
          className="relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-3xl"
          tabIndex={0}
          role="button"
          aria-label="Open Labor & Workforce Reports"
        >
          {/* Stack Layer 2 (Furthest Back / Highest) */}
          <div className="absolute -top-3.5 inset-x-8 h-8 rounded-t-[22px] bg-gradient-to-r from-teal-400/40 via-emerald-400/40 to-teal-500/40 transition-all duration-300 group-hover:-top-4.5 group-hover:inset-x-6" />

          {/* Stack Layer 1 (Middle Layer) */}
          <div className="absolute -top-2 inset-x-4 h-6 rounded-t-[24px] bg-gradient-to-r from-teal-500/70 via-emerald-600/70 to-teal-700/70 transition-all duration-300 group-hover:-top-2.5 group-hover:inset-x-2" />

          {/* Main Card (Front Deck) */}
          <div className="relative rounded-[28px] p-6 sm:p-7 text-white shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-gradient-to-b from-[#008770] via-[#007460] to-[#015345] flex flex-col justify-between min-h-[460px]">
            <div>
              {/* Circular Icon Badge */}
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center mb-6 shadow-inner text-white group-hover:scale-105 transition-transform duration-300">
                <Users size={22} className="stroke-[2.2]" />
              </div>

              {/* Card Title */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4 leading-snug">
                Starting with complete working systems
              </h2>

              {/* Point 1 */}
              <div className="space-y-1.5 mb-4">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-300 shrink-0" />
                  Site attendance & OT matrix
                </h3>
                <p className="text-xs sm:text-[13px] text-teal-50/85 leading-relaxed pl-5">
                  Pre-built daily shift hours, overtime calculations, break deductions, and subcontractor billing verification.
                </p>
              </div>

              {/* Point 2 */}
              <div className="space-y-1.5 mb-5">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <CalendarCheck2 size={14} className="text-emerald-300 shrink-0" />
                  Official Maga Time Card
                </h3>
                <p className="text-xs sm:text-[13px] text-teal-50/85 leading-relaxed pl-5">
                  Standard 31-day attendance sheet with Saturday, Sunday, Holiday markers, Advances, and DPA/PM signature blocks.
                </p>
              </div>
            </div>

            {/* Bottom Footer / Live KPI Metrics */}
            <div className="pt-4 border-t border-white/15 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-teal-200/90 font-medium block">
                  Workforce Scale
                </span>
                <span className="text-base font-bold text-white tabular-nums">
                  {isLoadingStats ? '…' : `${stats?.labor.totalWorkers ?? 120}+ Workers`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors backdrop-blur-xs">
                <span>View Reports</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 2: Operator & Machinery Drivers (Deep Purple / Indigo) ── */}
        <div 
          onClick={() => onSelectCategory('operator')}
          className="relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-3xl"
          tabIndex={0}
          role="button"
          aria-label="Open Operator & Machinery Driver Reports"
        >
          {/* Stack Layer 2 (Furthest Back / Highest) */}
          <div className="absolute -top-3.5 inset-x-8 h-8 rounded-t-[22px] bg-gradient-to-r from-purple-400/40 via-indigo-400/40 to-violet-500/40 transition-all duration-300 group-hover:-top-4.5 group-hover:inset-x-6" />

          {/* Stack Layer 1 (Middle Layer) */}
          <div className="absolute -top-2 inset-x-4 h-6 rounded-t-[24px] bg-gradient-to-r from-purple-500/70 via-indigo-600/70 to-violet-700/70 transition-all duration-300 group-hover:-top-2.5 group-hover:inset-x-2" />

          {/* Main Card (Front Deck) */}
          <div className="relative rounded-[28px] p-6 sm:p-7 text-white shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-gradient-to-b from-[#49228a] via-[#3a1b73] to-[#2b1257] flex flex-col justify-between min-h-[460px]">
            <div>
              {/* Circular Icon Badge */}
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center mb-6 shadow-inner text-white group-hover:scale-105 transition-transform duration-300">
                <HardHat size={22} className="stroke-[2.2]" />
              </div>

              {/* Card Title */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4 leading-snug">
                Maintain quality without reinventing anything
              </h2>

              {/* Point 1 */}
              <div className="space-y-1.5 mb-4">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-indigo-300 shrink-0" />
                  Running chart & machine assignments
                </h3>
                <p className="text-xs sm:text-[13px] text-indigo-50/85 leading-relaxed pl-5">
                  Daily operator running charts with machine codes (e.g. EX-04), shift in/out times, and overtime audit logs.
                </p>
              </div>

              {/* Point 2 */}
              <div className="space-y-1.5 mb-5">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <Receipt size={14} className="text-indigo-300 shrink-0" />
                  BP bill, summary & 31-day time cards
                </h3>
                <p className="text-xs sm:text-[13px] text-indigo-50/85 leading-relaxed pl-5">
                  Subcontractor operator billing statements, monthly attendance summaries, and official Maga Time Cards.
                </p>
              </div>
            </div>

            {/* Bottom Footer / Live KPI Metrics */}
            <div className="pt-4 border-t border-white/15 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-indigo-200/90 font-medium block">
                  Certified Operators
                </span>
                <span className="text-base font-bold text-white tabular-nums">
                  {isLoadingStats ? '…' : `${stats?.operator.totalOperators ?? 24}+ Operators`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors backdrop-blur-xs">
                <span>View Reports</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 3: Equipment & Plant Fleet (Vibrant Sunset Orange / Amber) ── */}
        <div 
          onClick={() => onSelectCategory('equipment')}
          className="relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-3xl"
          tabIndex={0}
          role="button"
          aria-label="Open Equipment & Plant Fleet Reports"
        >
          {/* Stack Layer 2 (Furthest Back / Highest) */}
          <div className="absolute -top-3.5 inset-x-8 h-8 rounded-t-[22px] bg-gradient-to-r from-amber-400/40 via-orange-400/40 to-red-400/40 transition-all duration-300 group-hover:-top-4.5 group-hover:inset-x-6" />

          {/* Stack Layer 1 (Middle Layer) */}
          <div className="absolute -top-2 inset-x-4 h-6 rounded-t-[24px] bg-gradient-to-r from-amber-500/70 via-orange-500/70 to-red-600/70 transition-all duration-300 group-hover:-top-2.5 group-hover:inset-x-2" />

          {/* Main Card (Front Deck) */}
          <div className="relative rounded-[28px] p-6 sm:p-7 text-white shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl bg-gradient-to-b from-[#f35919] via-[#e24707] to-[#ba3300] flex flex-col justify-between min-h-[460px]">
            <div>
              {/* Circular Icon Badge */}
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center mb-6 shadow-inner text-white group-hover:scale-105 transition-transform duration-300">
                <Truck size={22} className="stroke-[2.2]" />
              </div>

              {/* Card Title */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4 leading-snug">
                Focus stays on growth, not firefighting
              </h2>

              {/* Point 1 */}
              <div className="space-y-1.5 mb-4">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-amber-200 shrink-0" />
                  Meter readings & fuel telemetry
                </h3>
                <p className="text-xs sm:text-[13px] text-orange-50/85 leading-relaxed pl-5">
                  Initial to final meter hours, idle vs working time, breakdown hours, and fuel consumption logs across the fleet.
                </p>
              </div>

              {/* Point 2 */}
              <div className="space-y-1.5 mb-5">
                <h3 className="text-sm font-semibold text-white/95 flex items-center gap-1.5">
                  <Layers size={14} className="text-amber-200 shrink-0" />
                  Monthly ERP tariff lines
                </h3>
                <p className="text-xs sm:text-[13px] text-orange-50/85 leading-relaxed pl-5">
                  Seamless multi-unit rate support (Hrs, Days, Mth, Km) with automatic end-of-month 1 Mth ERP billing row exports.
                </p>
              </div>
            </div>

            {/* Bottom Footer / Live KPI Metrics */}
            <div className="pt-4 border-t border-white/15 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-200/90 font-medium block">
                  Plant Machinery
                </span>
                <span className="text-base font-bold text-white tabular-nums">
                  {isLoadingStats ? '…' : `${stats?.equipment.totalEquipment ?? 45}+ Units`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-xl transition-colors backdrop-blur-xs">
                <span>View Reports</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Summary Quick Bar (Subtle & Clean) ── */}
      <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">
              Audit-Ready Maga ERP Integration
            </h4>
            <p className="text-xs text-slate-500">
              Approved records sync directly to Excel spreadsheets matching Maga SAP/ERP column specifications.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-700" /> Auto-Saved & Verified
          </span>
        </div>
      </div>
    </div>
  );
};
