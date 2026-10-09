/**
 * SATransfersPage.tsx — Super Admin: Inter-Project Employee Transfers
 *
 * Manage employee and equipment transfers between project sites.
 * Shows active, completed, and historical transfer records from MF_G_EmployeeTransfer.
 */
import { useState, useEffect } from 'react';
import { GitMerge, Search, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import api from '../../config/api';

interface Transfer {
  id: string;
  corporateEmployeeId: string;
  corporateEmployee?: { fullName: string; employeeCode: string };
  fromProjectId?: string;
  toProjectId: string;
  startDate: string;
  endDate?: string;
  status: string;
  remarks?: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <Clock size={9} /> Active
      </span>
    );
  }
  if (status === 'transferred') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={9} /> Transferred
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

export default function SATransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'transferred' | 'released'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setIsLoading(true);
      try {
        const res = await api.get('/corporate/transfers');
        if (!cancelled) setTransfers(res.data?.items ?? res.data ?? []);
      } catch {
        if (!cancelled) setError('Failed to load transfers.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  const filtered = transfers.filter((t) => {
    const matchSearch =
      !search ||
      t.corporateEmployee?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.corporateEmployee?.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; employeeCode: string; fullName: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; projectCode: string; projectName: string }[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const openNewTransferModal = async () => {
    setIsModalOpen(true);
    setModalError('');
    try {
      const [empRes, projRes] = await Promise.all([
        api.get('/corporate/employees?status=active'),
        api.get('/tenants'),
      ]);
      setEmployees(empRes.data?.items ?? []);
      setProjects(projRes.data ?? []);
      if (empRes.data?.items?.length > 0) setSelectedEmpId(empRes.data.items[0].id);
      if (projRes.data?.length > 0) setSelectedProjectId(projRes.data[0].id);
    } catch {
      setModalError('Failed to load employee or project options.');
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedProjectId) {
      setModalError('Please select both an employee and a target project.');
      return;
    }
    setIsSubmitting(true);
    setModalError('');
    try {
      const res = await api.post('/corporate/transfers', {
        corporateEmployeeId: selectedEmpId,
        toProjectId: selectedProjectId,
        startDate: transferDate,
        remarks: remarks.trim() || undefined,
      });
      if (res.data?.transfer) {
        setTransfers((prev) => [res.data.transfer, ...prev]);
        setIsModalOpen(false);
        setRemarks('');
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to execute transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <GitMerge size={20} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">Inter-Project Transfers</h1>
          </div>
          <p className="text-xs text-slate-500">Track employee allocation movements across construction sites</p>
        </div>
        <button
          type="button"
          onClick={openNewTransferModal}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
        >
          <GitMerge size={14} className="text-[#C9A84C]" />
          <span>New Transfer</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <XCircle size={16} /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-violet-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="text-sm border border-violet-200 rounded-lg bg-white text-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
        >
          <option value="all" className="bg-white text-slate-900">All status</option>
          <option value="active" className="bg-white text-slate-900">Active</option>
          <option value="transferred" className="bg-white text-slate-900">Transferred</option>
          <option value="released" className="bg-white text-slate-900">Released</option>
        </select>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-violet-100 p-4 animate-pulse">
              <div className="h-4 bg-violet-50 rounded w-40 mb-2" />
              <div className="h-3 bg-violet-50 rounded w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-violet-100 py-16 flex flex-col items-center gap-2">
          <GitMerge size={32} className="text-violet-200" />
          <p className="text-sm text-slate-400">No transfers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-violet-100 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {t.corporateEmployee?.fullName ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{t.corporateEmployee?.employeeCode}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono">
                  {t.fromProjectId ?? 'HQ'}
                </span>
                <ArrowRight size={12} className="text-[#C9A84C]" />
                <span className="bg-violet-50 border border-violet-200 text-violet-700 rounded px-1.5 py-0.5 font-mono">
                  {t.toProjectId}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                <p className="text-[11px] text-slate-400">
                  From {formatDate(t.startDate)}
                  {t.endDate ? ` → ${formatDate(t.endDate)}` : ' (ongoing)'}
                </p>
                {t.remarks && (
                  <p className="text-[10px] text-slate-400 italic truncate max-w-[120px]">{t.remarks}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Transfer Modal ────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-violet-100 text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">Execute Inter-Project Transfer</h2>
            <p className="text-xs text-slate-500 mb-4">
              Dispatches an employee to a project site, auto-closing previous assignment.
            </p>

            {modalError && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="space-y-3.5 bg-white text-slate-900">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                  required
                >
                  <option value="" className="bg-white text-slate-900">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-white text-slate-900">
                      {emp.employeeCode} - {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Project Site *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
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
                  placeholder="e.g. Reallocated for Phase 2 foundation works"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring…' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
