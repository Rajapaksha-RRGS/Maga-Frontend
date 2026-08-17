/**
 * useSupervisors.ts — State management for supervisor management.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Supervisor, SupervisorCreateData } from '../services/supervisorService';
import type { Employee } from '../../employees/services/employeeService';
import * as svc from '../services/supervisorService';

export function useSupervisors() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tempPasswordResult, setTempPasswordResult] = useState<{ name: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sups, emps] = await Promise.all([svc.getAll(), svc.getAvailableEmployees()]);
      setSupervisors(sups);
      setEmployees(emps);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = supervisors.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.fullName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
  });

  const add = async (data: SupervisorCreateData) => {
    const result = await svc.create(data);
    setTempPasswordResult({ name: result.supervisor.fullName, password: result.tempPassword });
    await load();
  };

  const resetPassword = async (id: string) => {
    const sup = supervisors.find((s) => s.id === id);
    const pw = await svc.resetPassword(id);
    setTempPasswordResult({ name: sup?.fullName ?? 'Supervisor', password: pw });
  };

  const deactivateSupervisor = async (id: string) => {
    await svc.deactivate(id);
    await load();
  };

  const clearTempPassword = () => setTempPasswordResult(null);

  return {
    supervisors, filtered, employees, isLoading, search, setSearch,
    tempPasswordResult, clearTempPassword,
    add, resetPassword, deactivateSupervisor, refresh: load,
  };
}
