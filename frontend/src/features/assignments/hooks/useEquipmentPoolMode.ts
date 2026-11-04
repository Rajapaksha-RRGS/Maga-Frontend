import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getTenantById } from '../../tenants/services/tenantService';

export const POOL_MODE_EVENT = 'equipment-pool-mode-changed';

export interface PoolModeDetail {
  projectId?: string;
  labor?: boolean;
  operator?: boolean;
  equipment?: boolean;
  enabled?: boolean;
}

export function notifyPoolModeChanged(
  projectId: string,
  modes: { labor?: boolean; operator?: boolean; equipment?: boolean } | boolean
) {
  const detail: PoolModeDetail = {
    projectId,
    ...(typeof modes === 'boolean'
      ? { equipment: modes, enabled: modes }
      : {
          labor: modes.labor,
          operator: modes.operator,
          equipment: modes.equipment,
          enabled: modes.equipment,
        }),
  };

  try {
    if (detail.labor !== undefined) localStorage.setItem(`maga_labor_pool_mode_${projectId}`, String(detail.labor));
    if (detail.operator !== undefined) localStorage.setItem(`maga_operator_pool_mode_${projectId}`, String(detail.operator));
    if (detail.equipment !== undefined) localStorage.setItem(`maga_pool_mode_${projectId}`, String(detail.equipment));
  } catch {}

  window.dispatchEvent(
    new CustomEvent(POOL_MODE_EVENT, {
      detail,
    })
  );
}

export function useEquipmentPoolMode() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [isLabourPoolMode, setIsLabourPoolMode] = useState<boolean>(() => {
    if (!tenantId) return false;
    try {
      const cached = localStorage.getItem(`maga_labor_pool_mode_${tenantId}`);
      if (cached !== null) return cached === 'true';
    } catch {}
    return false;
  });

  const [isOperatorPoolMode, setIsOperatorPoolMode] = useState<boolean>(() => {
    if (!tenantId) return false;
    try {
      const cached = localStorage.getItem(`maga_operator_pool_mode_${tenantId}`);
      if (cached !== null) return cached === 'true';
    } catch {}
    return false;
  });

  const [isEquipmentPoolMode, setIsEquipmentPoolMode] = useState<boolean>(() => {
    if (!tenantId) return false;
    try {
      const cached = localStorage.getItem(`maga_pool_mode_${tenantId}`);
      if (cached !== null) return cached === 'true';
    } catch {}
    return false;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    // Fetch live status from server
    getTenantById(tenantId)
      .then((data) => {
        if (!isMounted) return;
        const labor = Boolean(data?.laborAssignBySupervisor);
        const operator = Boolean(data?.operatorAssignBySupervisor);
        const equipment = Boolean(data?.equipmentAssignBySupervisor);

        setIsLabourPoolMode(labor);
        setIsOperatorPoolMode(operator);
        setIsEquipmentPoolMode(equipment);

        try {
          localStorage.setItem(`maga_labor_pool_mode_${tenantId}`, String(labor));
          localStorage.setItem(`maga_operator_pool_mode_${tenantId}`, String(operator));
          localStorage.setItem(`maga_pool_mode_${tenantId}`, String(equipment));
        } catch {}
      })
      .catch((err) => {
        console.warn('Could not fetch equipment pool mode for tenant:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Listen to live broadcast when admin flips any toggle in AdminSettingsPage
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PoolModeDetail>;
      if (customEvent.detail) {
        if (!customEvent.detail.projectId || customEvent.detail.projectId === tenantId) {
          if (customEvent.detail.labor !== undefined) setIsLabourPoolMode(customEvent.detail.labor);
          if (customEvent.detail.operator !== undefined) setIsOperatorPoolMode(customEvent.detail.operator);
          if (customEvent.detail.equipment !== undefined) setIsEquipmentPoolMode(customEvent.detail.equipment);
          else if (customEvent.detail.enabled !== undefined) setIsEquipmentPoolMode(customEvent.detail.enabled);
        }
      }
    };

    window.addEventListener(POOL_MODE_EVENT, handleEvent);

    return () => {
      isMounted = false;
      window.removeEventListener(POOL_MODE_EVENT, handleEvent);
    };
  }, [tenantId]);

  return {
    isPoolMode: isEquipmentPoolMode, // Backwards compatibility for existing equipment pool consumers
    isLabourPoolMode,
    isOperatorPoolMode,
    isEquipmentPoolMode,
    isLoading,
  };
}
