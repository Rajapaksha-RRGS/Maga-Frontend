import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getTenantById } from '../../tenants/services/tenantService';

export const POOL_MODE_EVENT = 'equipment-pool-mode-changed';

export function notifyPoolModeChanged(projectId: string, enabled: boolean) {
  try {
    localStorage.setItem(`maga_pool_mode_${projectId}`, String(enabled));
  } catch {}
  window.dispatchEvent(
    new CustomEvent(POOL_MODE_EVENT, {
      detail: { projectId, enabled },
    })
  );
}

export function useEquipmentPoolMode() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [isPoolMode, setIsPoolMode] = useState<boolean>(() => {
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
        const enabled = !!data?.equipmentAssignBySupervisor;
        setIsPoolMode(enabled);
        try {
          localStorage.setItem(`maga_pool_mode_${tenantId}`, String(enabled));
        } catch {}
      })
      .catch((err) => {
        console.warn('Could not fetch equipment pool mode for tenant:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Listen to live broadcast when admin flips the toggle in AdminSettingsPage
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId?: string; enabled?: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        if (!customEvent.detail.projectId || customEvent.detail.projectId === tenantId) {
          setIsPoolMode(customEvent.detail.enabled);
        }
      }
    };

    window.addEventListener(POOL_MODE_EVENT, handleEvent);

    return () => {
      isMounted = false;
      window.removeEventListener(POOL_MODE_EVENT, handleEvent);
    };
  }, [tenantId]);

  return { isPoolMode, isLoading };
}
