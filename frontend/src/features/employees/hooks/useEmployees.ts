/**
 * useEmployees.ts
 *
 * State management hook for the employees feature.
 * Handles: fetching, search, filtering (business partner, trade group),
 * CRUD operations. All business logic lives here, not in the page.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Employee, EmployeeFormData } from '../services/employeeService';
import * as svc from '../services/employeeService';

interface UseEmployeesReturn {
  employees: Employee[];
  filteredEmployees: Employee[];
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  businessPartnerFilter: string;
  setBusinessPartnerFilter: (v: string) => void;
  tradeGroupFilter: string;
  setTradeGroupFilter: (v: string) => void;
  businessPartners: string[];
  tradeGroups: string[];
  addEmployee: (data: EmployeeFormData) => Promise<void>;
  updateEmployee: (id: string, data: Partial<EmployeeFormData>) => Promise<void>;
  deactivateEmployee: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEmployees(): UseEmployeesReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [businessPartnerFilter, setBusinessPartnerFilter] = useState('');
  const [tradeGroupFilter, setTradeGroupFilter] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await svc.getAll();
      setEmployees(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter + search
  const filteredEmployees = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.callingName.toLowerCase().includes(q) ||
      e.fullName.toLowerCase().includes(q);
    const matchesBP = !businessPartnerFilter || e.businessPartner === businessPartnerFilter;
    const matchesTG = !tradeGroupFilter || e.tradeGroup === tradeGroupFilter;
    return matchesSearch && matchesBP && matchesTG;
  });

  const addEmployee = async (data: EmployeeFormData) => {
    await svc.create(data);
    await load();
  };

  const updateEmployee = async (id: string, data: Partial<EmployeeFormData>) => {
    await svc.update(id, data);
    await load();
  };

  const deactivateEmployee = async (id: string) => {
    await svc.deactivate(id);
    await load();
  };

  return {
    employees,
    filteredEmployees,
    isLoading,
    search,
    setSearch,
    businessPartnerFilter,
    setBusinessPartnerFilter,
    tradeGroupFilter,
    setTradeGroupFilter,
    businessPartners: svc.getBusinessPartners(),
    tradeGroups: svc.getTradeGroups(),
    addEmployee,
    updateEmployee,
    deactivateEmployee,
    refresh: load,
  };
}
