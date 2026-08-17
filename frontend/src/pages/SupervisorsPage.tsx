/**
 * SupervisorsPage.tsx — Admin supervisor management page.
 * Shows temp password in a banner after create/reset, with copy button.
 */
import { useState } from 'react';
import { Plus, Copy, CheckCircle2 } from 'lucide-react';
import { useSupervisors } from '../features/supervisors/hooks/useSupervisors';
import SupervisorTable from '../features/supervisors/components/SupervisorTable';
import SupervisorCardList from '../features/supervisors/components/SupervisorCardList';
import SupervisorForm from '../features/supervisors/components/SupervisorForm';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';

export default function SupervisorsPage() {
  const {
    filtered, employees, isLoading, search, setSearch,
    tempPasswordResult, clearTempPassword,
    add, resetPassword, deactivateSupervisor,
  } = useSupervisors();
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const openAdd = () => { clearTempPassword(); setPanelOpen(true); };
  const close = () => { setPanelOpen(false); };

  const handleSave = async (data: { fullName: string; username: string; linkedEmployeeId: string | null }) => {
    await add(data);
    close();
  };

  const handleCopyPassword = async () => {
    if (tempPasswordResult) {
      await navigator.clipboard.writeText(tempPasswordResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-medium text-slate-800">Supervisors</h1>
        <button id="sup-add-btn" onClick={openAdd} className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <Plus size={16} /><span>Add supervisor</span>
        </button>
      </div>

      {/* Temp password banner */}
      {tempPasswordResult && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-green-800">
              Temporary password for <span className="font-medium">{tempPasswordResult.name}</span>:
            </p>
            <p className="font-mono text-sm text-green-700 font-medium mt-0.5">{tempPasswordResult.password}</p>
          </div>
          <button
            onClick={handleCopyPassword}
            title="Copy password"
            className="w-9 h-9 rounded-md flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={clearTempPassword}
            className="text-xs text-green-600 hover:text-green-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supervisors…" />
      </div>

      {isLoading && <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}
      {!isLoading && filtered.length === 0 && <EmptyState message="No supervisors found." />}
      {!isLoading && filtered.length > 0 && (
        <>
          <SupervisorTable data={filtered} onRowClick={() => {}} onResetPassword={resetPassword} onDeactivate={deactivateSupervisor} />
          <SupervisorCardList data={filtered} onCardClick={() => {}} onResetPassword={resetPassword} onDeactivate={deactivateSupervisor} />
          <p className="text-xs text-slate-400 mt-3">{filtered.length} supervisor{filtered.length !== 1 ? 's' : ''}</p>
        </>
      )}

      <SlidePanel open={panelOpen} onClose={close} title="Add supervisor">
        <SupervisorForm employees={employees} onSave={handleSave} onCancel={close} />
      </SlidePanel>
    </div>
  );
}
