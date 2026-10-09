/**
 * SADashboardPage.tsx — Super Admin Executive Dashboard
 *
 * Head Office overview showing:
 *  - KPI tiles (Projects, Employees, Equipment, Transfers)
 *  - Active projects grid
 *  - Quick navigation shortcuts to master data
 */
import { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  Wrench,
  GitMerge,
  Building2,
  Tag,
  HardHat,
  ArrowRight,
  Activity,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalProjects: number;
  totalEmployees: number;
  totalEquipment: number;
  pendingTransfers: number;
  activeBusinessPartners: number;
  totalTradeGroups: number;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon,
  gradient,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  gradient: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-violet-100 px-5 py-4 shadow-sm hover:shadow-md hover:border-violet-200 transition-all duration-200 text-left w-full hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${gradient} shadow-sm`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-800 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-slate-500 mt-1 font-medium truncate">{label}</p>
      </div>
      <ArrowRight
        size={16}
        className="ml-auto text-slate-300 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all flex-shrink-0"
      />
    </button>
  );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────
function QuickActionCard({
  label,
  description,
  icon,
  to,
  color,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  color: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex items-start gap-3 bg-white rounded-xl border border-violet-100 px-4 py-3.5 hover:border-violet-300 hover:shadow-sm transition-all duration-200 text-left w-full focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color} mt-0.5`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-violet-50 rounded-xl ${className}`} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SADashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      setIsLoading(true);
      try {
        const res = await api.get('/corporate/stats');
        if (cancelled) return;

        if (res.data) {
          setStats({
            totalProjects: res.data.totalProjects ?? 0,
            totalEmployees: res.data.totalEmployees ?? 0,
            totalEquipment: res.data.totalEquipment ?? 0,
            pendingTransfers: res.data.pendingTransfers ?? 0,
            activeBusinessPartners: res.data.activeBusinessPartners ?? 0,
            totalTradeGroups: res.data.totalTradeGroups ?? 0,
          });
        }
      } catch {
        // Silently fail — show zeros
        if (!cancelled) {
          setStats({
            totalProjects: 0,
            totalEmployees: 0,
            totalEquipment: 0,
            pendingTransfers: 0,
            activeBusinessPartners: 0,
            totalTradeGroups: 0,
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-6 min-h-0">

      {/*
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A0A2E] via-[#2D1055] to-[#1A0A2E] px-6 py-5 shadow-lg border border-violet-500/20">
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-40 h-40 bg-violet-500/10 rounded-full translate-y-1/2 blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={18} className="text-[#C9A84C]" />
              <span className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-widest">
                Head Office — Global View
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">
              Welcome back, {displayName}!
            </h1>
            <p className="text-sm text-violet-300/70">
              You have full visibility across all projects and corporate master data.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </span>
            <p className="text-xs text-violet-400/60 font-mono">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>
      */}

      {/* ── KPI Tiles ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Activity size={12} />
          Corporate Overview
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard
              label="Active Projects"
              value={stats?.totalProjects ?? 0}
              icon={<Layers size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-violet-600 to-violet-800"
              onClick={() => navigate('/super-admin/projects')}
            />
            <KpiCard
              label="Global Employees"
              value={stats?.totalEmployees ?? 0}
              icon={<Users size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-blue-500 to-blue-700"
              onClick={() => navigate('/super-admin/employees')}
            />
            <KpiCard
              label="Global Equipment"
              value={stats?.totalEquipment ?? 0}
              icon={<Wrench size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-slate-600 to-slate-800"
              onClick={() => navigate('/super-admin/equipment')}
            />
            <KpiCard
              label="Business Partners"
              value={stats?.activeBusinessPartners ?? 0}
              icon={<Building2 size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-emerald-600 to-emerald-800"
              onClick={() => navigate('/super-admin/business-partners')}
            />
            <KpiCard
              label="Trade Groups"
              value={stats?.totalTradeGroups ?? 0}
              icon={<HardHat size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-orange-500 to-orange-700"
              onClick={() => navigate('/super-admin/trade-groups')}
            />
            <KpiCard
              label="Active Transfers"
              value={stats?.pendingTransfers ?? 0}
              icon={<GitMerge size={22} className="text-white" />}
              gradient="bg-gradient-to-br from-[#C9A84C] to-[#a07830]"
              onClick={() => navigate('/super-admin/transfers')}
            />
          </div>
        )}
      </section>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <section className="pb-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Globe size={12} />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickActionCard
            label="Register New Project"
            description="Onboard a new construction site with its admin credentials."
            icon={<Layers size={16} className="text-white" />}
            to="/super-admin/projects"
            color="bg-gradient-to-br from-violet-500 to-violet-700"
          />
          <QuickActionCard
            label="Add Corporate Employee"
            description="Register a new employee into the global master."
            icon={<Users size={16} className="text-white" />}
            to="/super-admin/employees"
            color="bg-gradient-to-br from-blue-500 to-blue-700"
          />
          <QuickActionCard
            label="Add Corporate Equipment"
            description="Add new machinery or vehicle to the corporate fleet."
            icon={<Wrench size={16} className="text-white" />}
            to="/super-admin/equipment"
            color="bg-gradient-to-br from-slate-600 to-slate-800"
          />
          <QuickActionCard
            label="Manage Trade Groups"
            description="Configure trade categories and standard daily rates."
            icon={<HardHat size={16} className="text-white" />}
            to="/super-admin/trade-groups"
            color="bg-gradient-to-br from-orange-500 to-orange-700"
          />
          <QuickActionCard
            label="Manage Activity Codes"
            description="Configure global IFS / SAP activity codes."
            icon={<Tag size={16} className="text-white" />}
            to="/super-admin/activity-codes"
            color="bg-gradient-to-br from-emerald-500 to-emerald-700"
          />
          <QuickActionCard
            label="Inter-Project Transfers"
            description="Allocate employees or equipment across project sites."
            icon={<GitMerge size={16} className="text-white" />}
            to="/super-admin/transfers"
            color="bg-gradient-to-br from-[#C9A84C] to-[#a07830]"
          />
        </div>
      </section>
    </div>
  );
}
