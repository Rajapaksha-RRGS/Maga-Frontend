/**
 * SAProjectsPage.tsx — Super Admin: Projects & Site Master Portal
 *
 * Dedicated portal for Super Admins to manage construction sites (MF_P_Project),
 * project managers, enterprise units, locations, and operational parameters.
 *
 * Features:
 * - Executive KPI stat cards (Total Sites, Active Projects, Cross-Project Workforce, Machinery Deployed)
 * - Real-time multi-field search and division/status filters
 * - Vertically scrollable table with sticky headers
 * - Comprehensive Project Registration & Edit Modal (NO CSV bulk upload per user requirements)
 * - Optional Site Admin user creation with 1-click clipboard credential copy banner
 * - In-place Site Admin password reset
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Key,
  CheckCircle2,
  Copy,
  X,
  AlertCircle,
  HardHat,
  Users,
  Wrench,
  FileText,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Check,
  Clock,
  AlertTriangle,
  Shield,
  Layers,
} from 'lucide-react';
import { api } from '../../config/api';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CorporateProjectItem {
  id: string;
  projectCode: string;
  projectName: string;
  subdomain: string;
  description?: string;
  searchKey?: string;
  projectManager?: string;
  addressCode?: string;
  enterpriseUnit?: string;
  currency?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  fax?: string;
  email?: string;
  status: 'active' | 'on_hold' | 'completed' | 'suspended';
  createdAt: string;
  userCount: number;
  employeeCount: number;
  equipmentCount: number;
  dailySheetCount: number;
  primaryAdmin?: {
    id: string;
    username: string;
    fullName: string;
    status: string;
  } | null;
}

const ENTERPRISE_UNITS = [
  'Highways & Expressways',
  'Bridges & Flyovers',
  'Building Construction',
  'Water Supply & Drainage',
  'Marine & Coastal Infrastructure',
  'Civil Infrastructure',
  'Industrial Engineering',
  'Special Projects',
];

export default function SAProjectsPage() {
  const [projects, setProjects] = useState<CorporateProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_hold' | 'completed' | 'suspended'>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Temporary password banner state (after creating project with admin or resetting admin password)
  const [tempPasswordResult, setTempPasswordResult] = useState<{
    name: string;
    username?: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<CorporateProjectItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formSubdomain, setFormSubdomain] = useState('');
  const [formName, setFormName] = useState('');
  const [formSearchKey, setFormSearchKey] = useState('');
  const [formEnterpriseUnit, setFormEnterpriseUnit] = useState('');
  const [formProjectManager, setFormProjectManager] = useState('');
  const [formAddressCode, setFormAddressCode] = useState('');
  const [formAddressLine1, setFormAddressLine1] = useState('');
  const [formAddressLine2, setFormAddressLine2] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'on_hold' | 'completed' | 'suspended'>('active');
  const [formDescription, setFormDescription] = useState('');

  // Optional Site Admin fields for new project registration
  const [createAdminAccount, setCreateAdminAccount] = useState(true);
  const [formAdminFullName, setFormAdminFullName] = useState('');
  const [formAdminUsername, setFormAdminUsername] = useState('');
  const [formAdminPassword, setFormAdminPassword] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/corporate/projects');
      setProjects(res.data?.items ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch corporate project master data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Filtered projects
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.projectCode.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        (p.subdomain && p.subdomain.toLowerCase().includes(q)) ||
        (p.projectManager && p.projectManager.toLowerCase().includes(q)) ||
        (p.enterpriseUnit && p.enterpriseUnit.toLowerCase().includes(q)) ||
        (p.searchKey && p.searchKey.toLowerCase().includes(q)) ||
        (p.addressLine1 && p.addressLine1.toLowerCase().includes(q)) ||
        (p.addressLine2 && p.addressLine2.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchUnit =
        unitFilter === 'all' ||
        (p.enterpriseUnit ? p.enterpriseUnit.toLowerCase() === unitFilter.toLowerCase() : unitFilter === 'none');

      return matchSearch && matchStatus && matchUnit;
    });
  }, [projects, search, statusFilter, unitFilter]);

  // Aggregate stats
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const totalWorkforce = projects.reduce((acc, p) => acc + (p.employeeCount || 0), 0);
  const totalEquipment = projects.reduce((acc, p) => acc + (p.equipmentCount || 0), 0);

  // Modal open handlers
  const openAddModal = () => {
    setEditingProject(null);
    setFormCode('');
    setFormSubdomain('');
    setFormName('');
    setFormSearchKey('');
    setFormEnterpriseUnit('');
    setFormProjectManager('');
    setFormAddressCode('');
    setFormAddressLine1('');
    setFormAddressLine2('');
    setFormPhone('');
    setFormEmail('');
    setFormStatus('active');
    setFormDescription('');
    setCreateAdminAccount(false); // Default to false (optional)
    setFormAdminFullName('');
    setFormAdminUsername('');
    setFormAdminPassword('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: CorporateProjectItem) => {
    setEditingProject(p);
    setFormCode(p.projectCode);
    setFormSubdomain(p.subdomain);
    setFormName(p.projectName);
    setFormSearchKey(p.searchKey || '');
    setFormEnterpriseUnit(p.enterpriseUnit || '');
    setFormProjectManager(p.projectManager || '');
    setFormAddressCode(p.addressCode || '');
    setFormAddressLine1(p.addressLine1 || '');
    setFormAddressLine2(p.addressLine2 || '');
    setFormPhone(p.phone || '');
    setFormEmail(p.email || '');
    setFormStatus(p.status || 'active');
    setFormDescription(p.description || '');

    if (p.primaryAdmin) {
      setCreateAdminAccount(true);
      setFormAdminFullName(p.primaryAdmin.fullName);
      setFormAdminUsername(p.primaryAdmin.username);
      setFormAdminPassword('');
    } else {
      setCreateAdminAccount(false);
      setFormAdminFullName(`Site Admin ${p.projectCode}`);
      setFormAdminUsername(`admin_${p.projectCode.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`);
      setFormAdminPassword('');
    }

    setFormError('');
    setIsModalOpen(true);
  };

  // Auto-sync subdomain and admin username when typing project code (in Add mode)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setFormCode(val);
    if (!editingProject) {
      const cleanSub = val.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      setFormSubdomain(cleanSub);
      if (!formAdminUsername || formAdminUsername.startsWith('admin')) {
        setFormAdminUsername(cleanSub ? `admin_${cleanSub}` : '');
      }
      if (!formAdminFullName || formAdminFullName.includes('Site Admin')) {
        setFormAdminFullName(val ? `Site Admin ${val}` : '');
      }
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Project Code (M-Code) and Project Name are required.');
      return;
    }

    if (createAdminAccount) {
      if (!formAdminFullName.trim() || !formAdminUsername.trim()) {
        setFormError('Admin Full Name and Admin Username are required when assigning a site administrator.');
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingProject) {
        // Update Project
        const payload = {
          projectName: formName.trim(),
          description: formDescription.trim() || undefined,
          searchKey: formSearchKey.trim() || undefined,
          projectManager: formProjectManager.trim() || undefined,
          addressCode: formAddressCode.trim() || undefined,
          enterpriseUnit: formEnterpriseUnit.trim() || undefined,
          addressLine1: formAddressLine1.trim() || undefined,
          addressLine2: formAddressLine2.trim() || undefined,
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          status: formStatus,
          ...(createAdminAccount && formAdminFullName.trim() && formAdminUsername.trim()
            ? {
                adminFullName: formAdminFullName.trim(),
                adminUsername: formAdminUsername.trim(),
                adminPassword: formAdminPassword.trim() || undefined,
              }
            : {}),
        };

        const res = await api.put(`/corporate/projects/${editingProject.id}`, payload);
        if (res.data?.project) {
          setProjects((prev) =>
            prev.map((item) => (item.id === editingProject.id ? res.data.project : item)),
          );

          if (res.data.tempPassword) {
            setTempPasswordResult({
              name: res.data.project.projectName,
              username: res.data.project.primaryAdmin?.username,
              password: res.data.tempPassword,
            });
          }
        }
        setIsModalOpen(false);
      } else {
        // Register New Project
        const payload = {
          projectCode: formCode.trim().toUpperCase(),
          projectName: formName.trim(),
          subdomain: (formSubdomain.trim() || formCode.trim()).toLowerCase(),
          description: formDescription.trim() || undefined,
          searchKey: formSearchKey.trim() || undefined,
          projectManager: formProjectManager.trim() || undefined,
          addressCode: formAddressCode.trim() || undefined,
          enterpriseUnit: formEnterpriseUnit.trim() || undefined,
          addressLine1: formAddressLine1.trim() || undefined,
          addressLine2: formAddressLine2.trim() || undefined,
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          status: formStatus,
          ...(createAdminAccount
            ? {
                adminFullName: formAdminFullName.trim(),
                adminUsername: formAdminUsername.trim(),
                adminPassword: formAdminPassword.trim() || undefined,
              }
            : {}),
        };

        const res = await api.post('/corporate/projects', payload);
        if (res.data?.project) {
          setProjects((prev) => [res.data.project, ...prev]);

          if (res.data.tempPassword) {
            setTempPasswordResult({
              name: res.data.project.projectName,
              username: res.data.project.primaryAdmin?.username,
              password: res.data.tempPassword,
            });
          }
        }
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (
    project: CorporateProjectItem,
    newStatus: 'active' | 'on_hold' | 'completed' | 'suspended',
  ) => {
    try {
      const res = await api.patch(`/corporate/projects/${project.id}/status`, { status: newStatus });
      if (res.data?.project) {
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p)),
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update project status');
    }
  };

  const handleResetAdminPassword = async (project: CorporateProjectItem) => {
    if (
      !confirm(
        `Are you sure you want to reset the admin password for "${project.projectName}" (${project.projectCode})?`,
      )
    ) {
      return;
    }

    try {
      const res = await api.post(`/corporate/projects/${project.id}/reset-admin-password`);
      if (res.data?.tempPassword) {
        setTempPasswordResult({
          name: `${project.projectName} (${res.data.adminName || 'Admin'})`,
          username: res.data.adminUsername,
          password: res.data.tempPassword,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reset admin password');
    }
  };

  const handleCopyPassword = async () => {
    if (tempPasswordResult) {
      await navigator.clipboard.writeText(tempPasswordResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen text-slate-800">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-900 to-indigo-800 text-white shadow-md">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Project Master Directory</h1>
                <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-0.5 rounded-full border border-violet-200">
                  {totalProjectsCount} Sites
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Central operational management of construction sites, enterprise units, project managers, and site admins.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons (NO CSV Upload button) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProjects}
            disabled={isLoading}
            title="Refresh list"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-900 to-indigo-800 rounded-lg shadow-md hover:from-violet-800 hover:to-indigo-700 transition-all cursor-pointer active:scale-98"
          >
            <Plus size={15} />
            <span>Register Project</span>
          </button>
        </div>
      </div>

      {/* ── Temporary Password Notification Banner ──────────────────── */}
      {tempPasswordResult && (
        <div className="flex items-start sm:items-center gap-3 bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 shadow-sm animate-fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-900">
              Site Admin Credentials for <span className="font-bold underline">{tempPasswordResult.name}</span>:
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {tempPasswordResult.username && (
                <span className="text-xs font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                  Username: <strong>{tempPasswordResult.username}</strong>
                </span>
              )}
              <span className="text-xs font-mono text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300 font-bold">
                Password: <strong>{tempPasswordResult.password}</strong>
              </span>
              <span className="text-[11px] text-emerald-700 italic">
                (Please copy and securely deliver this temporary password to the site engineer)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPassword}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Password</span>
                </>
              )}
            </button>
            <button
              onClick={() => setTempPasswordResult(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 px-1 py-1 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Stats Metric Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sites */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-violet-50 text-violet-700">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalProjectsCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Total Registered Sites</div>
          </div>
        </div>

        {/* Active Sites */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700">{activeProjectsCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Active Operations</div>
          </div>
        </div>

        {/* Allocated Workforce */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
            <Users size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalWorkforce}</div>
            <div className="text-[11px] text-slate-500 font-medium">Workforce Allocated</div>
          </div>
        </div>

        {/* Machinery Deployed */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
            <Wrench size={20} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalEquipment}</div>
            <div className="text-[11px] text-slate-500 font-medium">Machinery Deployed</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code (e.g. 530), name, project manager, or division…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Enterprise Unit Filter */}
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="all">All Divisions / Units</option>
            {ENTERPRISE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            <option value="none">Unassigned Unit</option>
          </select>

          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            {(['all', 'active', 'on_hold', 'completed', 'suspended'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors font-medium cursor-pointer ${
                  statusFilter === s
                    ? 'bg-white text-violet-800 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Scrollable Projects Table ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Site Code</th>
                <th className="px-4 py-3">Project Title & Description</th>
                <th className="px-4 py-3">Manager & Division</th>
                <th className="px-4 py-3">Location & Address</th>
                <th className="px-4 py-3">Resources</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-violet-600" />
                      <span>Loading project master records…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">No projects found</p>
                    <p className="text-[11px] mt-0.5">
                      {search || statusFilter !== 'all' || unitFilter !== 'all'
                        ? 'Try adjusting your filters or search query.'
                        : 'Click "Register Project" above to onboard your first construction site.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((proj) => (
                  <tr key={proj.id} className="hover:bg-violet-50/30 transition-colors">
                    {/* Code & Subdomain */}
                    <td className="px-4 py-3.5 font-mono">
                      <div className="font-bold text-violet-800 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-md inline-block">
                        {proj.projectCode}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        :{proj.subdomain}
                      </div>
                    </td>

                    {/* Name & Description */}
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-bold text-slate-900 text-sm">{proj.projectName}</div>
                      {proj.searchKey && (
                        <span className="inline-block mt-0.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                          {proj.searchKey}
                        </span>
                      )}
                      {proj.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{proj.description}</p>
                      )}
                    </td>

                    {/* Manager & Enterprise Unit */}
                    <td className="px-4 py-3.5">
                      {proj.projectManager ? (
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <HardHat size={13} className="text-amber-600 shrink-0" />
                          <span>{proj.projectManager}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned Manager</span>
                      )}
                      {proj.enterpriseUnit && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-1 font-medium">
                          <Briefcase size={11} className="text-slate-400 shrink-0" />
                          <span>{proj.enterpriseUnit}</span>
                        </div>
                      )}
                    </td>

                    {/* Location & Address */}
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {proj.addressLine1 || proj.addressLine2 ? (
                        <div className="text-slate-700 text-[11px] flex items-start gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {[proj.addressLine1, proj.addressLine2].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No address</span>
                      )}
                      {proj.phone && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} className="text-slate-400" />
                          <span>{proj.phone}</span>
                        </div>
                      )}
                      {proj.email && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail size={10} className="text-slate-400" />
                          <span className="truncate max-w-[160px]">{proj.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Resources */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Users size={11} className="text-blue-600" />
                          <span>{proj.employeeCount} Workforce</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Wrench size={11} className="text-amber-600" />
                          <span>{proj.equipmentCount} Equipment</span>
                        </span>
                        {proj.dailySheetCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <FileText size={11} className="text-violet-600" />
                            <span>{proj.dailySheetCount} Sheets</span>
                          </span>
                        )}
                        {proj.primaryAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Shield size={10} className="text-emerald-600" />
                            <span>@{proj.primaryAdmin.username}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            No Admin
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {proj.status === 'active' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                      {proj.status === 'on_hold' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <Clock size={11} className="text-amber-600" />
                          On Hold
                        </span>
                      )}
                      {proj.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                          <Check size={11} className="text-blue-600" />
                          Completed
                        </span>
                      )}
                      {proj.status === 'suspended' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                          <AlertTriangle size={11} className="text-red-600" />
                          Suspended
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Project */}
                        <button
                          onClick={() => openEditModal(proj)}
                          title="Edit project details"
                          className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit size={13} />
                        </button>

                        {/* Reset Site Admin Password (if exists) or Assign Admin */}
                        {proj.primaryAdmin ? (
                          <button
                            onClick={() => handleResetAdminPassword(proj)}
                            title="Reset site admin password"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Key size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              openEditModal(proj);
                              setCreateAdminAccount(true);
                            }}
                            title="Assign Site Admin to this project"
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md border border-amber-200 transition-colors cursor-pointer"
                          >
                            <Shield size={13} />
                          </button>
                        )}

                        {/* Status Toggle Dropdown / Button */}
                        {proj.status === 'active' ? (
                          <button
                            onClick={() => handleToggleStatus(proj, 'on_hold')}
                            title="Put on hold"
                            className="px-2 py-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                          >
                            Hold
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(proj, 'active')}
                            title="Activate project"
                            className="px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project Registration / Edit Modal ──────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-900 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 size={20} className="text-violet-200" />
                <div>
                  <h3 className="text-sm font-bold">
                    {editingProject ? `Edit Project: ${editingProject.projectCode}` : 'Register New Construction Project'}
                  </h3>
                  <p className="text-[11px] text-violet-200">
                    {editingProject
                      ? 'Update operational parameters and manager allocation'
                      : 'Onboard a new construction site and optionally set up initial site admin credentials'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProject} className="p-6 overflow-y-auto flex flex-col gap-4 text-slate-900">
              {formError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Identification */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-violet-700" />
                  <span>1. Project Identification</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Code */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Project Code (M-Code) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingProject}
                      placeholder="e.g. 530, 550, or PRJ-530"
                      value={formCode}
                      onChange={handleCodeChange}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  {/* Subdomain (Site Route) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Routing Subdomain <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingProject}
                      placeholder="e.g. 530 (used for site URL/routing)"
                      value={formSubdomain}
                      onChange={(e) => setFormSubdomain(e.target.value.toLowerCase())}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Full Project Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kandy Expressway Phase 2 - Kadugannawa Section"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Short Search Key */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Short Alias / Search Key
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KND-HWY or CEP-02"
                      value={formSearchKey}
                      onChange={(e) => setFormSearchKey(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                    />
                  </div>

                  {/* Enterprise Unit */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Enterprise Unit / Division
                    </label>
                    <select
                      value={formEnterpriseUnit}
                      onChange={(e) => setFormEnterpriseUnit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">— Select Enterprise Unit —</option>
                      {ENTERPRISE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Management & Location */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <HardHat size={13} className="text-amber-600" />
                  <span>2. Management & Site Location</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Project Manager */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Project Manager / Lead Engineer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Eng. Rohan Wickramaratne"
                      value={formProjectManager}
                      onChange={(e) => setFormProjectManager(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {/* Address Code / Depot */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Depot / Site Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DEPOT-KND-01"
                      value={formAddressCode}
                      onChange={(e) => setFormAddressCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Address Line 1 */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Site Address Line 1
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. No. 45, Site Office, Kadugannawa"
                      value={formAddressLine1}
                      onChange={(e) => setFormAddressLine1(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      City / District
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kandy, Central Province"
                      value={formAddressLine2}
                      onChange={(e) => setFormAddressLine2(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Phone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Site Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 081-2384910"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Site Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. site530@maga.lk"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Project Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 capitalize"
                    >
                      <option value="active">Active</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Scope of Work / Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the project scope, civil works, contract details..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              {/* Section 3: Site Administrator Account (Visible in Both Add & Edit Modes) */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={13} className="text-emerald-700" />
                    <span>
                      {editingProject?.primaryAdmin
                        ? '3. Site Administrator Account'
                        : editingProject
                        ? '3. Assign Site Administrator'
                        : '3. Initial Site Administrator (Optional)'}
                    </span>
                  </div>

                  {/* Toggle checkbox if no admin currently exists */}
                  {(!editingProject || !editingProject.primaryAdmin) && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-800">
                      <input
                        type="checkbox"
                        checked={createAdminAccount}
                        onChange={(e) => setCreateAdminAccount(e.target.checked)}
                        className="rounded text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        {editingProject ? 'Assign Site Admin' : 'Create Site Admin Account'}
                      </span>
                    </label>
                  )}

                  {/* Badge showing active status if admin exists */}
                  {editingProject?.primaryAdmin && (
                    <span className="text-[10px] font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300 font-semibold">
                      Current: @{editingProject.primaryAdmin.username}
                    </span>
                  )}
                </div>

                {/* Show admin inputs when admin exists or checkbox is checked */}
                {(createAdminAccount || editingProject?.primaryAdmin) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                        Admin Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={createAdminAccount || !!editingProject?.primaryAdmin}
                        placeholder="e.g. Site Admin 530"
                        value={formAdminFullName}
                        onChange={(e) => setFormAdminFullName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                        Admin Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={createAdminAccount || !!editingProject?.primaryAdmin}
                        placeholder="e.g. admin530"
                        value={formAdminUsername}
                        onChange={(e) => setFormAdminUsername(e.target.value.toLowerCase())}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                          {editingProject?.primaryAdmin ? 'New Password' : 'Temporary Password'}
                        </label>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {editingProject?.primaryAdmin ? 'Leave blank to keep' : 'Auto-generated'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder={
                          editingProject?.primaryAdmin
                            ? 'Leave blank to keep current'
                            : 'Leave blank to auto-generate'
                        }
                        value={formAdminPassword}
                        onChange={(e) => setFormAdminPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-800 italic pt-1">
                    No site administrator assigned yet. Check the box above if you want to create an admin user for this project.
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-900 to-indigo-800 hover:from-violet-800 hover:to-indigo-700 rounded-lg shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Saving…'
                    : editingProject
                    ? 'Update Project'
                    : 'Save & Register Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
