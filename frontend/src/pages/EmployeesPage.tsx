/**
 * EmployeesPage.tsx
 *
 * Admin employee management page. Assembles feature components —
 * no business logic here (all in useEmployees hook per spec rule).
 *
 * Responsive: DataTable on md+, CardList below md.
 */
import { useState, useEffect, useMemo } from 'react';
import { ArrowRightLeft, Check, Clock, UserPlus } from 'lucide-react';
import api from '../config/api';
import { useEmployees } from '../features/employees/hooks/useEmployees';
import EmployeeTable from '../features/employees/components/EmployeeTable';
import EmployeeCardList from '../features/employees/components/EmployeeCardList';
import EmployeeForm from '../features/employees/components/EmployeeForm';
import EmployeeFilters from '../features/employees/components/EmployeeFilters';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import EmployeeImportView from '../features/employees/components/EmployeeImportView';
import DirectSiteRegisterModal from '../features/employees/components/DirectSiteRegisterModal';
import Breadcrumb from '../components/Breadcrumb';
import type { CorporateEmployee } from '../features/master-import/services/corporateMasterService';
import type { Employee } from '../features/employees/services/employeeService';
import * as employeeService from '../features/employees/services/employeeService';
import type { BusinessPartner } from '../features/business-partners/services/businessPartnerService';
import * as businessPartnerService from '../features/business-partners/services/businessPartnerService';

interface PendingTransferItem {
  id: string;
  corporateEmployee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    nicNo: string;
    tradeGroup?: { name: string };
  };
  fromProject?: { id: string; projectCode: string; projectName: string };
  toProject?: { id: string; projectCode: string; projectName: string };
  startDate: string;
  remarks?: string;
}

export default function EmployeesPage() {
  const {
    employees,
    filteredEmployees,
    isLoading,
    error,
    search,
    setSearch,
    businessPartnerFilter,
    setBusinessPartnerFilter,
    tradeGroupFilter,
    setTradeGroupFilter,
    statusFilter,
    setStatusFilter,
    clearFilters,
    businessPartners,
    tradeGroups,
    addEmployee,
    updateEmployee,
    activateEmployee,
    deactivateEmployee,
    toggleStatus,
    refresh,
  } = useEmployees();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [registeredPartners, setRegisteredPartners] = useState<BusinessPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransferItem[]>([]);
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [isDirectRegisterModalOpen, setIsDirectRegisterModalOpen] = useState(false);

  const fetchPendingTransfers = async () => {
    try {
      const res = await api.get('/corporate/transfers/pending');
      setPendingTransfers(res.data?.items || []);
    } catch (e) {
      console.error('Failed to load pending transfers:', e);
    }
  };

  useEffect(() => {
    fetchPendingTransfers();
  }, []);

  const handleApproveRelease = async (transferId: string) => {
    setIsProcessingTransfer(true);
    try {
      await api.post(`/corporate/transfers/${transferId}/approve`);
      await refresh();
      await fetchPendingTransfers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve transfer');
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  const handleRejectRelease = async (transferId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    setIsProcessingTransfer(true);
    try {
      await api.post(`/corporate/transfers/${transferId}/reject`, { reason });
      await fetchPendingTransfers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject transfer');
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  const existingCodes = useMemo(() => {
    return new Set(employees.map((e) => (e.employeeCode || e.id).toUpperCase()));
  }, [employees]);

  const handleBatchImport = async (items: CorporateEmployee[]) => {
    for (const item of items) {
      const partnerCodeOrName = item.businessPartnerCode || item.businessPartnerName || item.businessPartner || 'BP1002885';
      const matchedPartner = registeredPartners.find(
        (p) => p.code.toLowerCase() === partnerCodeOrName.toLowerCase() ||
               p.name.toLowerCase() === partnerCodeOrName.toLowerCase()
      );

      await addEmployee({
        employeeCode: item.employeeCode,
        callingName: item.callingName,
        fullName: item.fullName,
        businessPartnerId: matchedPartner?.id || '',
        businessPartner: partnerCodeOrName,
        tradeGroup: item.tradeGroup,
        nicNo: item.nicNo,
        dailyRate: item.dailyRate ?? 0,
        epfNo: item.epfNo,
        isOperator: item.isOperator,
        licenseNo: item.licenseNo,
      });
    }
    await fetchPartners();
  };

  const handleTransferEmployee = async (
    item: CorporateEmployee,
    _fromSiteName?: string,
    startDate?: string,
    remarks?: string
  ) => {
    try {
      await api.post('/corporate/transfers/request', {
        employeeCode: item.employeeCode,
        startDate: startDate || new Date().toISOString().split('T')[0],
        remarks: remarks || 'Transfer requested via Site Admin Portal',
      });
    } catch (err: any) {
      console.warn('Fallback direct transfer notice:', err);
      await employeeService.transferEmployee({
        employeeCode: item.employeeCode,
        callingName: item.callingName,
        fullName: item.fullName,
        nicNo: item.nicNo,
        businessPartnerName: item.businessPartner,
        tradeGroup: item.tradeGroup,
        dailyRate: item.dailyRate,
        epfNo: item.epfNo,
      });
    }

    // Refresh active employees in project view
    await refresh();
    await fetchPendingTransfers();
  };

  const fetchPartners = async () => {
    setLoadingPartners(true);
    try {
      const res = await businessPartnerService.getAll();
      setRegisteredPartners(res);
    } catch (err) {
      console.error('Failed to load registered partners in EmployeesPage:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingEmployee(null);
  };

  const handleSave = async (data: Parameters<typeof addEmployee>[0]) => {
    if (editingEmployee) {
      await updateEmployee(editingEmployee.id, data);
    } else {
      await addEmployee(data);
    }
    closePanel();
  };

  const handleDeactivate = async (id: string) => {
    await deactivateEmployee(id);
    closePanel();
  };

  const handleActivate = async (id: string) => {
    await activateEmployee(id);
    closePanel();
  };

  // Partner names for filter: prefer registered partners, fallback to employee derived
  const filterPartnerNames =
    registeredPartners.length > 0
      ? [...new Set(registeredPartners.map((p) => p.name))].sort()
      : businessPartners;

  return (
    <div
      className={[
        'bg-[#F7F8FA] w-full',
        importModalOpen
          ? 'h-full max-h-full flex-1 flex flex-col min-h-0 p-2 md:p-3 overflow-hidden box-border overscroll-none'
          : 'min-h-full px-4 md:px-6 py-5',
      ].join(' ')}
    >
      {importModalOpen ? (
        <div className="flex-1 min-h-0 h-full flex flex-col animate-in fade-in duration-150">
          <EmployeeImportView
            onBack={() => setImportModalOpen(false)}
            existingCodes={existingCodes}
            onImport={handleBatchImport}
            onTransfer={handleTransferEmployee}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-medium text-slate-800">Employees</h1>
                {!isLoading && (
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {filteredEmployees.length} of {employees.length}
                  </span>
                )}
              </div>
              <Breadcrumb items={[{ label: 'Master Data' }, { label: 'Employee Master' }]} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <button
                id="site-direct-register-btn"
                onClick={() => setIsDirectRegisterModalOpen(true)}
                title="Enroll walk-in personnel and subcontractors directly at site gate"
                className="flex items-center gap-2 bg-emerald-700 text-white font-medium text-sm rounded-lg px-3.5 min-h-[44px] transition-colors hover:bg-emerald-800 active:bg-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
              >
                <UserPlus size={16} />
                <span>+ Direct Site Register</span>
              </button>
              <button
                id="emp-import-btn"
                onClick={() => setImportModalOpen(true)}
                title="Mobilize new personnel from Central Depot or request transfers from other sites"
                className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-800 active:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer shadow-xs"
              >
                <UserPlus size={16} />
                <span>Mobilize from Corporate</span>
              </button>
            </div>
          </div>

          {/* 2-Way Handshake: Pending Inter-Site Transfer Requests Banner */}
          {pendingTransfers.length > 0 && (
            <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-xs animate-in fade-in">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                  <ArrowRightLeft size={16} className="text-amber-600" />
                  <span>Pending Inter-Site Transfer Requests ({pendingTransfers.length})</span>
                </div>
                <span className="text-[11px] font-medium text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                  2-Way Handshake Release Required
                </span>
              </div>
              <div className="space-y-2">
                {pendingTransfers.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white p-3 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{req.corporateEmployee?.fullName}</span>
                        <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {req.corporateEmployee?.employeeCode}
                        </span>
                        <span className="text-slate-500 font-medium">
                          ({req.corporateEmployee?.tradeGroup?.name || 'General Labour'})
                        </span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>Requested by Project:</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {req.toProject?.projectName || req.toProject?.projectCode}
                        </span>
                        {req.startDate && (
                          <span className="text-slate-500 flex items-center gap-1 ml-1">
                            <Clock size={11} /> Effective: {new Date(req.startDate).toLocaleDateString()}
                          </span>
                        )}
                        {req.remarks && (
                          <span className="italic text-slate-600 ml-1">
                            — "{req.remarks}"
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRejectRelease(req.id)}
                        disabled={isProcessingTransfer}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveRelease(req.id)}
                        disabled={isProcessingTransfer}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Check size={13} />
                        <span>Approve & Release</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prerequisite banner: If no business partners exist */}
          {!loadingPartners && registeredPartners.length === 0 && (
            <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-amber-900">No Business Partners Registered</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Employees must be linked to a registered business partner. Please register at least one business partner before adding employees.
                </p>
              </div>
              <a
                href="/admin/business-partners"
                className="whitespace-nowrap px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Register Business Partner
              </a>
            </div>
          )}

          {/* Error notification */}
          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => {
                  refresh();
                  fetchPartners();
                }}
                className="text-xs font-semibold underline hover:text-red-900 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by Trade Group, NIC, Code, or Name…"
              />
            </div>
            <EmployeeFilters
              businessPartners={filterPartnerNames}
              tradeGroups={tradeGroups}
              businessPartnerFilter={businessPartnerFilter}
              tradeGroupFilter={tradeGroupFilter}
              statusFilter={statusFilter}
              onBusinessPartnerChange={setBusinessPartnerFilter}
              onTradeGroupChange={setTradeGroupFilter}
              onStatusChange={setStatusFilter}
              onClearFilters={clearFilters}
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <p className="text-sm text-slate-400 py-8 text-center">Loading employees from backend…</p>
          )}

          {/* Data */}
          {!isLoading && filteredEmployees.length === 0 && (
            <EmptyState message="No employees match your search." />
          )}

          {!isLoading && filteredEmployees.length > 0 && (
            <>
              <EmployeeTable
                data={filteredEmployees}
                onRowClick={openEdit}
                onToggleStatus={toggleStatus}
              />
              <EmployeeCardList
                data={filteredEmployees}
                onCardClick={openEdit}
                onToggleStatus={toggleStatus}
              />
            </>
          )}

          {/* Result count */}
          {!isLoading && filteredEmployees.length > 0 && (
            <p className="text-xs text-slate-400 mt-3">
              {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}

      {/* Manual Slide Panel Form */}
      <SlidePanel open={panelOpen} onClose={closePanel} title={editingEmployee ? 'Edit Employee' : 'Add Employee'}>
        <EmployeeForm
          employee={editingEmployee}
          businessPartners={registeredPartners}
          onSave={handleSave}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
          onCancel={closePanel}
        />
      </SlidePanel>

      {/* Direct Site Registration Modal */}
      <DirectSiteRegisterModal
        isOpen={isDirectRegisterModalOpen}
        onClose={() => setIsDirectRegisterModalOpen(false)}
        onSuccess={refresh}
        existingPartners={registeredPartners}
      />
    </div>
  );
}
