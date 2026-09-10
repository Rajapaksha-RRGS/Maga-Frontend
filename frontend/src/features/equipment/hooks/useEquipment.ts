/**
 * useEquipment.ts — State management for equipment feature.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Equipment, EquipmentFormData } from '../services/equipmentService';
import * as svc from '../services/equipmentService';
import { cacheManager } from '../../../utils/cacheManager';

export function useEquipment() {
  const [items, setItems] = useState<Equipment[]>(() => cacheManager.get<Equipment[]>('equipment:list') || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheManager.get<Equipment[]>('equipment:list'));
  const [search, setSearch] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh || !cacheManager.get('equipment:list')) {
      setIsLoading(true);
    }
    try {
      const data = await svc.getAll();
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.code && e.code.toLowerCase().includes(q)) || e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  });

  const add = async (data: EquipmentFormData) => { await svc.create(data); await load(); };
  const edit = async (id: string, data: Partial<EquipmentFormData>) => { await svc.update(id, data); await load(); };
  const remove = async (id: string) => { await svc.deactivate(id); await load(); };

  return { items, filtered, isLoading, search, setSearch, add, edit, remove, refresh: load };
}
