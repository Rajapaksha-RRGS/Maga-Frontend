/**
 * useBusinessPartners.ts
 *
 * State management hook for Business Partners CRUD and search.
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  BusinessPartner,
  BusinessPartnerFormData,
} from '../services/businessPartnerService';
import * as bpService from '../services/businessPartnerService';

export function useBusinessPartners() {
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await bpService.getAll();
      setPartners(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered partners by search & status
  const filteredPartners = partners.filter((bp) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      bp.name.toLowerCase().includes(q) ||
      bp.code.toLowerCase().includes(q) ||
      (bp.contactPerson && bp.contactPerson.toLowerCase().includes(q)) ||
      (bp.phone && bp.phone.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'all' || bp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const addPartner = async (data: BusinessPartnerFormData) => {
    await bpService.create(data);
    await load();
  };

  const updatePartner = async (id: string, data: Partial<BusinessPartnerFormData>) => {
    await bpService.update(id, data);
    await load();
  };

  const deletePartner = async (id: string) => {
    await bpService.remove(id);
    await load();
  };

  const togglePartnerStatus = async (id: string) => {
    await bpService.toggleStatus(id);
    await load();
  };

  const checkUniqueCode = (code: string, excludeId?: string): boolean => {
    const clean = code.trim().toUpperCase();
    return !partners.some(
      (bp) => bp.code.toUpperCase() === clean && bp.id !== excludeId
    );
  };

  // Synchronous local next-code suggestion (derived from already-loaded partners list).
  // Returns a BP code immediately without waiting for a network call,
  // which is required because BusinessPartnerForm calls suggestNextCode() synchronously.
  const suggestNextCode = (): string => {
    const nums = partners
      .map((bp) => bp.code.toUpperCase())
      .filter((c) => /^BP1\d{6}$/.test(c))
      .map((c) => parseInt(c.slice(3), 10));
    const max = nums.length > 0 ? Math.max(...nums) : 4093;
    return `BP1${String(max + 1).padStart(6, '0')}`;
  };

  return {
    partners,
    filteredPartners,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    addPartner,
    updatePartner,
    deletePartner,
    togglePartnerStatus,
    checkUniqueCode,
    suggestNextCode,
    refresh: load,
  };
}
