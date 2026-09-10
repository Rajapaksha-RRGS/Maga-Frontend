/**
 * EmployeesPage.tsx
 *
 * Admin employee management page. Assembles feature components —
 * no business logic here (all in useEmployees hook per spec rule).
 *
 * Responsive: DataTable on md+, CardList below md.
 */
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useEmployees } from '../features/employees/hooks/useEmployees';
import EmployeeTable from '../features/employees/components/EmployeeTable';
import EmployeeCardList from '../features/employees/components/EmployeeCardList';
import EmployeeForm from '../features/employees/components/EmployeeForm';
import EmployeeFilters from '../features/employees/components/EmployeeFilters';
import SearchInput from '../components/SearchInput';
import SlidePanel from '../components/SlidePanel';
import EmptyState from '../components/EmptyState';
import type { Employee } from '../features/employees/services/employeeService';
import type { BusinessPartner } from '../features/business-partners/services/businessPartnerService';
import * as businessPartnerService from '../features/business-partners/services/businessPartnerService';

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
    deactivateEmployee,
    refresh,
  } = useEmployees();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [registeredPartners, setRegisteredPartners] = useState<BusinessPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

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

  const openAdd = () => {
    setEditingEmployee(null);
    setPanelOpen(true);
  };

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

  // Partner names for filter: prefer registered partners, fallback to employee derived
  const filterPartnerNames =
    registeredPartners.length > 0
      ? [...new Set(registeredPartners.map((p) => p.name))].sort()
      : businessPartners;

  return (
    <div className="px-4 md:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-medium text-slate-800">Employees</h1>
          {!isLoading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredEmployees.length} of {employees.length} employees
            </p>
          )}
        </div>
        <button
          id="emp-add-btn"
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Plus size={16} />
          <span>Add employee</span>
        </button>
      </div>

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
          <EmployeeTable data={filteredEmployees} onRowClick={openEdit} />
          <EmployeeCardList data={filteredEmployees} onCardClick={openEdit} />
        </>
      )}

      {/* Result count */}
      {!isLoading && filteredEmployees.length > 0 && (
        <p className="text-xs text-slate-400 mt-3">
          {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Slide panel */}
      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
        title={editingEmployee ? 'Edit employee' : 'Add employee'}
      >
        <EmployeeForm
          employee={editingEmployee}
          businessPartners={registeredPartners}
          onSave={handleSave}
          onDeactivate={handleDeactivate}
          onCancel={closePanel}
        />
      </SlidePanel>
    </div>
  );
}
