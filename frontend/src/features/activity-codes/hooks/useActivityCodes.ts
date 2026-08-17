/**
 * useActivityCodes.ts — State management for activity codes feature.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ActivityCode, ActivityCodeFormData } from '../services/activityCodeService';
import * as svc from '../services/activityCodeService';

export function useActivityCodes() {
  const [items, setItems] = useState<ActivityCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setItems(await svc.getAll()); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const add = async (data: ActivityCodeFormData) => {
    setError(null);
    try { await svc.create(data); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); throw e; }
  };

  const edit = async (id: string, data: Partial<ActivityCodeFormData>) => {
    setError(null);
    try { await svc.update(id, data); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); throw e; }
  };

  const del = async (id: string) => {
    await svc.remove(id); await load();
  };

  const checkUnique = (code: string, excludeId?: string) => svc.isCodeUnique(code, excludeId);

  return { items, filtered, isLoading, search, setSearch, error, setError, add, edit, del, checkUnique, refresh: load };
}
