/**
 * EmployeesPage.tsx
 *
 * Admin employee management page. Assembles feature components —
 * no business logic here (all in useEmployees hook per spec rule).
 *
 * Responsive: DataTable on md+, CardList below md.
 */
import { useState } from 'react';
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

export default function EmployeesPage() {
  const {
    filteredEmployees,
    isLoading,
    search,
    setSearch,
    businessPartnerFilter,
    setBusinessPartnerFilter,
    tradeGroupFilter,
    setTradeGroupFilter,
    businessPartners,
    tradeGroups,
    addEmployee,
    updateEmployee,
    deactivateEmployee,
  } = useEmployees();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

  return (
    <div className="px-4 md:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-medium text-slate-800">Employees</h1>
        <button
          id="emp-add-btn"
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Plus size={16} />
          <span>Add employee</span>
        </button>
      </div>

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
          businessPartners={businessPartners}
          tradeGroups={tradeGroups}
          businessPartnerFilter={businessPartnerFilter}
          tradeGroupFilter={tradeGroupFilter}
          onBusinessPartnerChange={setBusinessPartnerFilter}
          onTradeGroupChange={setTradeGroupFilter}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-slate-400 py-8 text-center">Loading employees…</p>
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
          onSave={handleSave}
          onDeactivate={handleDeactivate}
          onCancel={closePanel}
        />
      </SlidePanel>
    </div>
  );
}
