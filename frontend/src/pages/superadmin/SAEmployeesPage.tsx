/**
 * SAEmployeesPage.tsx — Super Admin: Global Employee Master
 *
 * Central Corporate Labour Catalog (MF_G_EMPLOYEE).
 * Allows Super Admin to view the entire workforce across all sites,
 * register new global employees, batch import, and track project locations.
 */
import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  GitMerge,
  UploadCloud,
  Clock,
  FileText,
  Check,
  AlertTriangle,
  ShieldCheck,
  Lock,
  ExternalLink,
} from 'lucide-react';
import api from '../../config/api';
import SACsvImportModal from '../../components/SACsvImportModal';

const EMP_SAMPLE_HEADERS = [
  'employeeCode',
  'fullName',
  'nicNo',
  'tradeGroup',
  'dailyRate',
  'isOperator',
  'epfNo',
  'employeeType',
  'businessPartnerCode',
];
const EMP_SAMPLE_DATA: Record<string, string>[] = [
  {
    employeeCode: 'R8184',
    fullName: 'Piyasena PWM',
    nicNo: '921530170V',
    tradeGroup: 'Driver',
    dailyRate: '2500',
    isOperator: 'true',
    epfNo: '',
    employeeType: 'external',
    businessPartnerCode: 'BP1002885',
  },
  {
    employeeCode: 'R8562',
    fullName: 'Vipula RA',
    nicNo: '672970342V',
    tradeGroup: 'Driver',
    dailyRate: '2500',
    isOperator: 'true',
    epfNo: '74493',
    employeeType: 'external',
    businessPartnerCode: 'BP1002885',
  },
  {
    employeeCode: 'HI101',
    fullName: 'Kamal Perera',
    nicNo: '881234567V',
    tradeGroup: 'Mason',
    dailyRate: '1800',
    isOperator: 'false',
    epfNo: 'EPF-9021',
    employeeType: 'internal',
    businessPartnerCode: '',
  },
  {
    employeeCode: 'HK030',
    fullName: 'Lab Helper HK030',
    nicNo: '961173612V',
    tradeGroup: 'Backlog Clearance',
    dailyRate: '1400',
    isOperator: 'false',
    epfNo: '',
    employeeType: 'external',
    businessPartnerCode: 'BP1020469',
  },
];
const EMP_REQUIRED_FIELDS = ['employeeCode', 'fullName', 'nicNo', 'tradeGroup'];

interface CorporateEmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  nicNo: string;
  epfNo?: string;
  dailyRate: number;
  isOperator: boolean;
  status: string;
  tradeGroupId?: string;
  tradeGroup: string;
  tradeGroupCode?: string;
  employeeType: 'internal' | 'external';
  businessPartner: string;
  businessPartnerCode?: string;
  currentWorkingProject?: string;
  activeProject?: { id: string; projectCode: string; projectName: string } | null;
  documentUrl?: string | null;
}

interface PendingEmployeeItem {
  id: string;
  employeeCode: string;
  fullName: string;
  nicNo: string;
  epfNo?: string;
  dailyRate: number;
  isOperator: boolean;
  employeeType: 'internal' | 'external';
  documentUrl?: string | null;
  status: string;
  createdAt: string;
  tradeGroup: string;
  tradeGroupCode?: string;
  tradeGroupId?: string;
  businessPartnerId?: string | null;
  businessPartnerName: string;
  businessPartnerCode: string;
  businessPartnerStatus: string;
  businessPartnerBrNumber?: string | null;
  businessPartnerDocumentUrl?: string | null;
  isBusinessPartnerApproved: boolean;
  projectCode: string;
  projectName: string;
  siteEmployeeId?: string | null;
}

interface TradeGroupOption {
  id: string;
  code: string;
  name: string;
  standardDailyRate: number;
}

interface PartnerOption {
  id: string;
  code: string;
  name: string;
}

interface ProjectOption {
  id: string;
  projectCode: string;
  projectName: string;
}

export default function SAEmployeesPage() {
  const [activeTab, setActiveTab] = useState<'workforce' | 'pending'>('workforce');
  const [employees, setEmployees] = useState<CorporateEmployeeItem[]>([]);
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployeeItem[]>([]);
  const [tradeGroups, setTradeGroups] = useState<TradeGroupOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [search, setSearch] = useState('');
  const [tradeGroupFilter, setTradeGroupFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Approval Modal State
  const [approvalTarget, setApprovalTarget] = useState<PendingEmployeeItem | null>(null);
  const [suggestedCode, setSuggestedCode] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNic, setFormNic] = useState('');
  const [formEpf, setFormEpf] = useState('');
  const [formTradeGroupId, setFormTradeGroupId] = useState('');
  const [formDailyRate, setFormDailyRate] = useState('1400');
  const [formIsOperator, setFormIsOperator] = useState(false);
  const [formEmployeeType, setFormEmployeeType] = useState<'internal' | 'external'>('internal');
  const [formPartnerId, setFormPartnerId] = useState('');
  const [formInitialProject, setFormInitialProject] = useState('');

  // Transfer Quick Modal
  const [transferTarget, setTransferTarget] = useState<CorporateEmployeeItem | null>(null);
  const [transferProject, setTransferProject] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empRes, tgRes, bpRes, projRes, pendRes] = await Promise.all([
        api.get('/corporate/employees'),
        api.get('/corporate/trade-groups'),
        api.get('/corporate/business-partners'),
        api.get('/tenants'),
        api.get('/corporate/employees/pending'),
      ]);
      setEmployees(empRes.data?.items ?? []);
      setTradeGroups(tgRes.data?.items ?? []);
      setPartners(bpRes.data?.items ?? []);
      setProjects(projRes.data ?? []);
      setPendingEmployees(pendRes.data?.items ?? []);
    } catch {
      setError('Failed to load global employees.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPending = async () => {
    setIsLoadingPending(true);
    try {
      const res = await api.get('/corporate/employees/pending');
      setPendingEmployees(res.data?.items || []);
    } catch (e) {
      console.error('Failed to load pending employees:', e);
    } finally {
      setIsLoadingPending(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openApproveModal = (target: PendingEmployeeItem) => {
    setApprovalTarget(target);
    setApprovalError('');
    if (target.employeeCode.includes('TMP')) {
      const prefix = target.employeeType === 'internal' ? 'HI' : 'HK';
      const matching = employees
        .filter((e) => e.employeeCode.startsWith(prefix))
        .map((e) => parseInt(e.employeeCode.replace(/[^0-9]/g, ''), 10))
        .filter((n) => !isNaN(n));
      const nextNum = matching.length > 0 ? Math.max(...matching) + 1 : 501;
      setSuggestedCode(`${prefix}${nextNum}`);
    } else {
      setSuggestedCode(target.employeeCode);
    }
  };

  const handleApprove = async () => {
    if (!approvalTarget) return;
    setIsApproving(true);
    setApprovalError('');
    try {
      await api.post(`/corporate/employees/${approvalTarget.id}/approve`, {
        officialCode: suggestedCode.trim() || undefined,
      });
      setApprovalTarget(null);
      await loadData();
    } catch (err: any) {
      setApprovalError(err.response?.data?.error || 'Failed to approve employee');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (target: PendingEmployeeItem) => {
    const reason = prompt(`Enter rejection reason for ${target.fullName} (${target.employeeCode}):`);
    if (reason === null) return;
    try {
      await api.post(`/corporate/employees/${target.id}/reject`, { reason });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject employee');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim() || !formNic.trim()) {
      setAddError('Employee Code, Full Name, and NIC No are required');
      return;
    }
    if (!formTradeGroupId) {
      setAddError('Trade Group is strictly required. Please select a valid Trade Group.');
      return;
    }
    if (formEmployeeType === 'external' && !formPartnerId) {
      setAddError('Please select a Business Partner for external / subcontractor employee');
      return;
    }
    setIsSubmitting(true);
    setAddError('');
    try {
      await api.post('/corporate/employees', {
        employeeCode: formCode.trim().toUpperCase(),
        fullName: formName.trim(),
        nicNo: formNic.trim().toUpperCase(),
        epfNo: formEpf.trim() || undefined,
        tradeGroupId: formTradeGroupId,
        dailyRate: parseFloat(formDailyRate) || 1400,
        isOperator: formIsOperator,
        employeeType: formEmployeeType,
        corporateBusinessPartnerId: formEmployeeType === 'external' ? formPartnerId : null,
        currentWorkingProject: formInitialProject || undefined,
      });
      setIsAddModalOpen(false);
      // Reset form
      setFormCode('');
      setFormName('');
      setFormNic('');
      setFormEpf('');
      setFormTradeGroupId('');
      setFormDailyRate('1400');
      setFormIsOperator(false);
      setFormEmployeeType('internal');
      setFormPartnerId('');
      setFormInitialProject('');
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget || !transferProject) {
      setTransferError('Please select a target project.');
      return;
    }
    setIsTransferring(true);
    setTransferError('');
    try {
      await api.post('/corporate/transfers', {
        corporateEmployeeId: transferTarget.id,
        toProjectId: transferProject,
        startDate: transferDate,
        remarks: transferRemarks.trim() || undefined,
      });
      setTransferTarget(null);
      setTransferRemarks('');
      await loadData();
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer employee');
    } finally {
      setIsTransferring(false);
    }
  };

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      emp.fullName.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.nicNo.toLowerCase().includes(q);
    const matchTG = tradeGroupFilter === 'all' || emp.tradeGroupId === tradeGroupFilter;
    const matchType = typeFilter === 'all' || emp.employeeType === typeFilter;
    return matchSearch && matchTG && matchType;
  });

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Users size={20} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">Global Employee Master</h1>
          </div>
          <p className="text-xs text-slate-500">
            Head Office central workforce catalog (MF_G_EMPLOYEE) across all sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Secondary Action: Bulk Import CSV */}
          <button
            id="sa-emp-import-csv-btn"
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-800 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud size={14} className="text-[#C9A84C]" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setAddError('');
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Global Employee</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-violet-100 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('workforce')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'workforce'
              ? 'bg-[#1A0A2E] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-violet-50'
          }`}
        >
          <Users size={14} />
          <span>Active Workforce Master ({employees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pending');
            fetchPending();
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'pending'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <Clock size={14} />
          <span>Pending HO Approvals</span>
          {pendingEmployees.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
              }`}
            >
              {pendingEmployees.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'pending' ? (
        /* ── Pending Approvals Tab View ──────────────────────────────── */
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">Dual Approval & Payroll Lock Active: </span>
              Gate walk-in workers and subcontractors are allowed to record daily site attendance immediately, but
              salary disbursement and BP payment billing remain <strong>locked</strong> until Head Office Super Admin
              reviews the scanned verification dossier (NIC, Birth Cert & BR) and issues official permanent codes.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[380px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
                  <tr className="border-b border-violet-100 bg-violet-50/90">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Provisional Code / Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Project Site</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">NIC / Trade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type & Business Partner</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Verification Dossier</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50">
                  {isLoadingPending ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-28" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-24" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-16" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : pendingEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                        No pending walk-in employee approvals. All site registrations have been verified.
                      </td>
                    </tr>
                  ) : (
                    pendingEmployees.map((emp) => {
                      const docUrl = emp.documentUrl
                        ? (emp.documentUrl.startsWith('http') ? emp.documentUrl : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${emp.documentUrl.startsWith('/') ? '' : '/'}${emp.documentUrl}`)
                        : null;
                      return (
                        <tr key={emp.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 font-bold text-amber-800 text-xs font-mono">
                              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                                {emp.employeeCode}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-800 text-xs mt-1">{emp.fullName}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                              <Building2 size={11} /> {emp.projectCode || 'Site'}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">{emp.projectName}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="font-mono text-slate-700">{emp.nicNo}</div>
                            <div className="inline-block mt-0.5 bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {emp.tradeGroup}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {emp.employeeType === 'internal' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                <Building2 size={11} className="text-blue-500" />
                                Mäga Direct
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                  <Users size={11} className="text-purple-500" />
                                  <span className="max-w-[120px] truncate">{emp.businessPartnerName}</span>
                                </span>
                                <div className="mt-1">
                                  {emp.businessPartnerStatus === 'pending_approval' ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                      <Clock size={9} /> BP Pending HO
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                      <CheckCircle2 size={9} /> BP Approved
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {docUrl ? (
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                <FileText size={12} className="text-rose-600" />
                                <span>PDF Dossier</span>
                                <ExternalLink size={10} className="text-rose-400" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No PDF file</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                              <Lock size={10} className="text-amber-600" /> Payment Held
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openApproveModal(emp)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                <ShieldCheck size={12} />
                                <span>Review & Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(emp)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ── Active Workforce Master Tab ─────────────────────────────── */
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Name, Code, or NIC…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-violet-200 rounded-lg bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-slate-700"
            >
              <option value="all">All Employment Types</option>
              <option value="internal">Direct Employees (Internal)</option>
              <option value="external">Subcontractors (External)</option>
            </select>
            <select
              value={tradeGroupFilter}
              onChange={(e) => setTradeGroupFilter(e.target.value)}
              className="text-sm border border-violet-200 rounded-lg bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-slate-700"
            >
              <option value="all">All Trade Groups</option>
              {tradeGroups.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[380px]">
              <table className="w-full text-sm">
            <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
              <tr className="border-b border-violet-100 bg-violet-50/90">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Code / Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">NIC / EPF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type / Partner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Trade Group</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Rate (LKR)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Site</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-28" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-violet-50 rounded w-12" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    No corporate employees found.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold">
                          {emp.employeeCode}
                        </span>
                        <span className="font-medium text-slate-800">{emp.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>NIC: {emp.nicNo}</div>
                      {emp.epfNo && <div className="text-[10px] text-slate-400">EPF: {emp.epfNo}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {emp.employeeType === 'internal' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          <Building2 size={11} className="text-blue-500" />
                          Mäga Direct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full" title={emp.businessPartner}>
                          <Users size={11} className="text-purple-500" />
                          <span className="max-w-[130px] truncate">{emp.businessPartner}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                        {emp.tradeGroup}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-slate-700 tabular-nums">
                      {emp.dailyRate.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {emp.activeProject ? (
                        <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                          <Building2 size={11} /> {emp.activeProject.projectCode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Central Pool
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {emp.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget(emp);
                          setTransferError('');
                          if (projects.length > 0) setTransferProject(projects[0].id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Transfer to another project"
                      >
                        <GitMerge size={12} className="text-[#C9A84C]" />
                        <span>Transfer</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-violet-50 bg-violet-50/30 shrink-0">
            <p className="text-xs text-slate-400">
              {filtered.length} corporate employee{filtered.length !== 1 ? 's' : ''} in pool
            </p>
          </div>
        )}
      </div>
    </>
  )}

  {/* ── Super Admin Walk-In Approval Modal ───────────────────────── */}
  {approvalTarget && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
      style={{ colorScheme: 'light' }}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 max-h-[90vh] overflow-y-auto text-slate-900"
        style={{ colorScheme: 'light' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="text-emerald-600" size={20} />
          <h2 className="text-base font-bold text-slate-900">Approve Gate Walk-In & Issue Official ID</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Verify submitted identity and assign a permanent corporate identifier (HI series for direct, HK/R series for subcontractors).
        </p>

        {approvalError && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
            {approvalError}
          </div>
        )}

        {/* Candidate Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Provisional Code</span>
              <div className="font-mono font-bold text-amber-800">{approvalTarget.employeeCode}</div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Site Project</span>
              <div className="font-semibold text-violet-800">{approvalTarget.projectCode} ({approvalTarget.projectName})</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-slate-400 text-[10px]">Candidate Name</span>
              <div className="font-semibold text-slate-800">{approvalTarget.fullName}</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">NIC / ID Card</span>
              <div className="font-mono text-slate-800">{approvalTarget.nicNo}</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">Trade Group</span>
              <div className="font-medium text-slate-700">{approvalTarget.tradeGroup}</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">Daily Rate</span>
              <div className="font-medium text-slate-700">LKR {approvalTarget.dailyRate.toLocaleString()}</div>
            </div>
          </div>

          {approvalTarget.employeeType === 'external' && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-[10px]">Business Partner / Subcontractor</span>
                  <div className="font-semibold text-purple-800">{approvalTarget.businessPartnerName} ({approvalTarget.businessPartnerCode})</div>
                </div>
                <div>
                  {approvalTarget.businessPartnerStatus === 'pending_approval' ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Clock size={10} /> BP Pending HO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 size={10} /> BP Approved
                    </span>
                  )}
                </div>
              </div>

              {approvalTarget.businessPartnerStatus === 'pending_approval' && (
                <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/70 border border-amber-300/80 rounded-lg p-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-700" />
                  <div>
                    <strong>Notice:</strong> This subcontractor is also awaiting HO approval. Approving this employee
                    now will register their permanent ID, but <strong>payroll will stay held</strong> until the
                    Business Partner is approved under Corporate Business Partners.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PDF Scanned Document View Button */}
          {approvalTarget.documentUrl ? (
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Scanned Worker Dossier (NIC + Birth Cert):</span>
              <a
                href={
                  approvalTarget.documentUrl.startsWith('http')
                    ? approvalTarget.documentUrl
                    : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${
                        approvalTarget.documentUrl.startsWith('/') ? '' : '/'
                      }${approvalTarget.documentUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg transition-colors"
              >
                <FileText size={13} className="text-rose-600" />
                <span>Open Scanned PDF</span>
                <ExternalLink size={11} className="text-rose-400" />
              </a>
            </div>
          ) : (
            <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-400 italic">
              No scanned document attached to this registration.
            </div>
          )}
        </div>

        {/* Official Code Assignment */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Official Corporate Permanent Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={suggestedCode}
            onChange={(e) => setSuggestedCode(e.target.value.toUpperCase())}
            placeholder={approvalTarget.employeeType === 'internal' ? 'e.g. HI501' : 'e.g. HK501'}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Suggested next available corporate code. Replacing provisional code ({approvalTarget.employeeCode}) will sync across HO master and site roster.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setApprovalTarget(null)}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving || !suggestedCode.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
          >
            <Check size={14} />
            {isApproving ? 'Approving…' : 'Confirm Approval & Issue Permanent ID'}
          </button>
        </div>
      </div>
    </div>
  )}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 max-h-[90vh] overflow-y-auto text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">Add Global Employee (MF_G_EMPLOYEE)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Register an employee in the central Head Office pool. Site Admins can then import them into their project.
            </p>

            {addError && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-3.5 bg-white text-slate-900">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP1029"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIC No *</label>
                  <input
                    type="text"
                    placeholder="e.g. 199014502891"
                    value={formNic}
                    onChange={(e) => setFormNic(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. K.M. Sunil Bandara"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">EPF No (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. EPF-89211"
                    value={formEpf}
                    onChange={(e) => setFormEpf(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Trade Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formTradeGroupId}
                    required
                    onChange={(e) => {
                      setFormTradeGroupId(e.target.value);
                      const matched = tradeGroups.find((t) => t.id === e.target.value);
                      if (matched) setFormDailyRate(String(matched.standardDailyRate));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  >
                    <option value="" className="bg-white text-slate-900">-- Choose Trade Group * --</option>
                    {tradeGroups.map((tg) => (
                      <option key={tg.id} value={tg.id} className="bg-white text-slate-900">
                        {tg.code} - {tg.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Employment Type Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Employment Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setFormEmployeeType('internal'); setFormPartnerId(''); }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      formEmployeeType === 'internal'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 size={14} className={formEmployeeType === 'internal' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Direct Employee (Internal)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormEmployeeType('external')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      formEmployeeType === 'external'
                        ? 'bg-purple-50 border-purple-400 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users size={14} className={formEmployeeType === 'external' ? 'text-purple-600' : 'text-slate-400'} />
                    <span>Subcontractor (External)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Daily Rate (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDailyRate}
                    onChange={(e) => setFormDailyRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  />
                </div>
                <div>
                  {formEmployeeType === 'external' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business Partner / Contractor <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formPartnerId}
                        onChange={(e) => setFormPartnerId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                        required
                      >
                        <option value="" className="bg-white text-slate-900">-- Choose Business Partner * --</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id} className="bg-white text-slate-900">
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Employer / Entity</label>
                      <div className="w-full px-3 py-2 text-xs font-medium border border-blue-200 rounded-lg bg-blue-50/70 text-blue-800 flex items-center gap-1.5">
                        <Building2 size={13} className="text-blue-600" />
                        <span>Mäga Engineering (Direct Payroll)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Initial Project Site Assignment (Optional)
                </label>
                <select
                  value={formInitialProject}
                  onChange={(e) => setFormInitialProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                >
                  <option value="" className="bg-white text-slate-900">Keep in Central Available Pool</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-white text-slate-900">
                      {proj.projectCode} - {proj.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isOperator"
                  checked={formIsOperator}
                  onChange={(e) => setFormIsOperator(e.target.checked)}
                  className="rounded text-violet-600 focus:ring-violet-400"
                />
                <label htmlFor="isOperator" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Certified Heavy Equipment Operator
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering…' : 'Register Global Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Transfer Modal ─────────────────────────────────────── */}
      {transferTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-violet-100 text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">Transfer Employee</h2>
            <p className="text-xs text-slate-500 mb-4">
              Reassign <span className="font-semibold text-slate-800">{transferTarget.fullName}</span> ({transferTarget.employeeCode}) to a new project site.
            </p>

            {transferError && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {transferError}
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5 bg-white text-slate-900">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Project Site *</label>
                <select
                  value={transferProject}
                  onChange={(e) => setTransferProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                >
                  <option value="" className="bg-white text-slate-900">-- Choose Project --</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-white text-slate-900">
                      {proj.projectCode} - {proj.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Effective Transfer Date *</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Transferred for civil works Phase 2"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isTransferring ? 'Transferring…' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Universal CSV Import Modal ──────────────────────────────── */}
      <SACsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Import Corporate Employees via CSV"
        entityName="Employee"
        endpoint="/corporate/employees/bulk-import"
        sampleHeaders={EMP_SAMPLE_HEADERS}
        sampleData={EMP_SAMPLE_DATA}
        requiredFields={EMP_REQUIRED_FIELDS}
        columnLabels={{
          employeeCode: 'Employee Code',
          fullName: 'Full Name',
          nicNo: 'NIC Number',
          tradeGroup: 'Trade Group * (Strictly Required)',
          dailyRate: 'Daily Rate (LKR)',
          isOperator: 'Is Machine Operator (true/false)',
          epfNo: 'EPF Number',
          businessPartnerCode: 'Business Partner Code',
        }}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
