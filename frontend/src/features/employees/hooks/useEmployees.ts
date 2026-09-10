/**
 * useEmployees.ts
 *
 * State management hook for the employees feature.
 * Handles: fetching, search, filtering (business partner, trade group),
 * CRUD operations. All business logic lives here, not in the page.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Employee, EmployeeFormData } from '../services/employeeService';
import * as employeeService from '../services/employeeService';

interface UseEmployeesReturn {
  employees: Employee[];
  filteredEmployees: Employee[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (v: string) => void;
  businessPartnerFilter: string;
  setBusinessPartnerFilter: (v: string) => void;
  tradeGroupFilter: string;
  setTradeGroupFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  clearFilters: () => void;
  businessPartners: string[];
  tradeGroups: string[];
  addEmployee: (data: EmployeeFormData) => Promise<void>;
  updateEmployee: (id: string, data: Partial<EmployeeFormData>) => Promise<void>;
  deactivateEmployee: (id: string) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEmployees(): UseEmployeesReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [businessPartnerFilter, setBusinessPartnerFilter] = useState('');
  const [tradeGroupFilter, setTradeGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await employeeService.getAll(undefined, forceRefresh);
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load employees from backend:', err);
      setError(err?.message || 'Failed to load employees from backend');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derived unique filter lists directly from backend employees
  const businessPartners = useMemo(() => {
    return employeeService.getBusinessPartners(employees);
  }, [employees]);

  const tradeGroups = useMemo(() => {
    return employeeService.getTradeGroups(employees);
  }, [employees]);

  // Filter + search
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (e.callingName && e.callingName.toLowerCase().includes(q)) ||
        (e.fullName && e.fullName.toLowerCase().includes(q)) ||
        (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.tradeGroup && e.tradeGroup.toLowerCase().includes(q)) ||
        (e.nicNo && e.nicNo.toLowerCase().includes(q)) ||
        (e.businessPartner && e.businessPartner.toLowerCase().includes(q));

      const matchesBP = !businessPartnerFilter || e.businessPartner.toLowerCase() === businessPartnerFilter.toLowerCase();
      const matchesTG = !tradeGroupFilter || e.tradeGroup.toLowerCase() === tradeGroupFilter.toLowerCase();
      const matchesStatus = !statusFilter || e.status === statusFilter;

      return matchesSearch && matchesBP && matchesTG && matchesStatus;
    });
  }, [employees, search, businessPartnerFilter, tradeGroupFilter, statusFilter]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setBusinessPartnerFilter('');
    setTradeGroupFilter('');
    setStatusFilter('');
  }, []);

  const addEmployee = async (data: EmployeeFormData) => {
    await employeeService.create(data);
    await load();
  };

  const updateEmployee = async (id: string, data: Partial<EmployeeFormData>) => {
    await employeeService.update(id, data);
    await load();
  };

  const deactivateEmployee = async (id: string) => {
    await employeeService.deactivate(id);
    await load();
  };

  const deleteEmployee = async (id: string) => {
    await employeeService.deleteEmployee(id);
    await load();
  };

  return {
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
    deleteEmployee,
    refresh: () => load(true),
  };
}

