/**
 * useTenants.ts — Hook managing Multi-Tenant portal state.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  TenantRecord,
  TenantRegisterInput,
  TenantUpdateInput,
} from '../services/tenantService';
import * as svc from '../services/tenantService';

export function useTenants() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Temporary password banner for created or reset credentials
  const [tempPasswordResult, setTempPasswordResult] = useState<{
    name: string;
    username?: string;
    password: string;
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await svc.getAllTenants();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tenants.filter((t) => {
      const matchesSearch =
        !q ||
        t.companyName.toLowerCase().includes(q) ||
        t.subdomain.toLowerCase().includes(q) ||
        t.primaryAdmin?.fullName.toLowerCase().includes(q) ||
        t.primaryAdmin?.username.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ? true : t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === 'active').length;
    const suspended = total - active;
    const totalAdmins = tenants.filter((t) => t.primaryAdmin).length;
    return { total, active, suspended, totalAdmins };
  }, [tenants]);

  const register = async (input: TenantRegisterInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await svc.registerTenant(input);
      if (result.tempPassword) {
        setTempPasswordResult({
          name: `${result.tenant.companyName} Admin (${input.adminFullName})`,
          username: input.adminUsername,
          password: result.tempPassword,
        });
      }
      await load();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to register tenant');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = async (id: string, input: TenantUpdateInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await svc.updateTenant(id, input);
      await load();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update tenant');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await svc.toggleTenantStatus(id, nextStatus);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to change tenant status');
    }
  };

  const resetAdminPassword = async (id: string) => {
    try {
      const result = await svc.resetTenantAdminPassword(id);
      setTempPasswordResult({
        name: result.adminName,
        password: result.tempPassword,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to reset admin password');
    }
  };

  const clearTempPassword = () => setTempPasswordResult(null);

  return {
    tenants,
    filtered,
    stats,
    isLoading,
    isSubmitting,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    tempPasswordResult,
    clearTempPassword,
    register,
    update,
    toggleStatus,
    resetAdminPassword,
    refresh: load,
  };
}
