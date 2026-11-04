/**
 * AdminSettingsPage.tsx — Site Admin Settings
 *
 * Operational and site configuration for the Site Admin:
 *  - Labour Pool Mode: Supervisor Self-Assign from Pool vs Admin Pre-Assignment
 *  - Operator Pool Mode: Supervisor Self-Assign from Pool vs Admin Pre-Assignment
 *  - Equipment Pool Mode: Supervisor Self-Assign from Yard vs Admin Pre-Assignment
 *  - Site profile and active project parameters
 */
import { useState, useEffect } from 'react';
import {
  Settings,
  HardHat,
  Cog,
  Tractor,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  getTenantById,
  updatePoolModes,
  fetchCorporateProjects,
  type CorporateProjectOption,
  type TenantRecord,
} from '../features/tenants/services/tenantService';
import { notifyPoolModeChanged } from '../features/assignments/hooks/useEquipmentPoolMode';

type ResourceType = 'labour' | 'operator' | 'equipment';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [project, setProject] = useState<TenantRecord | null>(null);
  const [corporateProjects, setCorporateProjects] = useState<CorporateProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(user?.tenantId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingResource, setUpdatingResource] = useState<ResourceType | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Load project configuration
  const loadProjectConfig = async (projId: string) => {
    if (!projId) return;
    setIsLoading(true);
    setErrorToast(null);
    try {
      const data = await getTenantById(projId);
      setProject(data);
    } catch (err: any) {
      console.warn('Failed to load project settings:', err);
      setErrorToast('Could not load site configuration. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If admin has a tenantId, load it directly
    if (user?.tenantId) {
      setSelectedProjectId(user.tenantId);
      loadProjectConfig(user.tenantId);
    } else {
      // If no tenantId is tied to auth, fallback to corporate projects list
      fetchCorporateProjects()
        .then((list) => {
          setCorporateProjects(list);
          if (list.length > 0) {
            setSelectedProjectId(list[0].id);
            loadProjectConfig(list[0].id);
          }
        })
        .catch(() => setIsLoading(false));
    }
  }, [user?.tenantId]);

  const handleToggleMode = async (resource: ResourceType, nextState: boolean) => {
    if (!selectedProjectId || updatingResource) return;
    setUpdatingResource(resource);
    setSuccessToast(null);
    setErrorToast(null);

    const payload = {
      ...(resource === 'labour' ? { laborAssignBySupervisor: nextState } : {}),
      ...(resource === 'operator' ? { operatorAssignBySupervisor: nextState } : {}),
      ...(resource === 'equipment' ? { equipmentAssignBySupervisor: nextState } : {}),
    };

    try {
      await updatePoolModes(selectedProjectId, payload);
      notifyPoolModeChanged(selectedProjectId, {
        [resource === 'labour' ? 'labor' : resource]: nextState,
      });

      setProject((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...(resource === 'labour' ? { laborAssignBySupervisor: nextState } : {}),
          ...(resource === 'operator' ? { operatorAssignBySupervisor: nextState } : {}),
          ...(resource === 'equipment' ? { equipmentAssignBySupervisor: nextState } : {}),
        };
      });

      const messages: Record<ResourceType, { enabled: string; disabled: string }> = {
        labour: {
          enabled: 'Labour Pool Mode Enabled: Supervisors can directly pick site workers from the labour pool.',
          disabled: 'Classic Admin Pre-Assign Enforced: Site labourers must be assigned by Admin daily.',
        },
        operator: {
          enabled: 'Operator Pool Mode Enabled: Supervisors can directly claim plant operators from the pool.',
          disabled: 'Classic Admin Pre-Assign Enforced: Operators must be pre-assigned by Admin daily.',
        },
        equipment: {
          enabled: 'Equipment Pool Mode Enabled: Supervisors can directly select machinery from the site yard.',
          disabled: 'Classic Admin Pre-Assign Enforced: Machinery must be pre-assigned by Admin daily.',
        },
      };

      setSuccessToast(nextState ? messages[resource].enabled : messages[resource].disabled);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || `Failed to update ${resource} assignment mode.`);
    } finally {
      setUpdatingResource(null);
    }
  };

  const isLabourPool = !!project?.laborAssignBySupervisor;
  const isOperatorPool = !!project?.operatorAssignBySupervisor;
  const isEquipmentPool = !!project?.equipmentAssignBySupervisor;

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-6 min-h-0 pb-16">
      {/* ── Breadcrumb & Page Header ── */}
      <div className="space-y-2">
        <Breadcrumb items={[{ label: 'Settings' }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Settings size={18} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Site Settings</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure operational dispatch rules and assignment modes (Pool Mode vs Admin Pre-Assignment) for site resources.
            </p>
          </div>

          {/* Site Selector if user has multiple sites or super admin preview */}
          {corporateProjects.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Select Site:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  loadProjectConfig(e.target.value);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {corporateProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.projectName || p.description}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Toasts ── */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 max-w-3xl">
          <Loader2 size={20} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading site settings...</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {/* Section Subtitle */}
          <div className="border-b border-slate-200/80 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Site Resource Assignment Modes (Pool vs Pre-Assign)
            </h2>
          </div>

          {/* ── 1. Labour Pool Mode Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isLabourPool
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <HardHat size={18} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-800">
                    Labour Pool Mode
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isLabourPool
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isLabourPool ? 'Pool Mode Active' : 'Classic Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Allow field supervisors to directly search and pull site workers from the central site labour pool into their daily work sheets without requiring daily manual pre-assignment by Site Admin.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                {isLabourPool ? 'Active' : 'Disabled'}
              </span>
              <button
                type="button"
                disabled={updatingResource !== null}
                onClick={() => handleToggleMode('labour', !isLabourPool)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  isLabourPool ? 'bg-emerald-500' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                title={isLabourPool ? 'Disable Labour Pool Mode' : 'Enable Labour Pool Mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    isLabourPool ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {updatingResource === 'labour' && (
                    <Loader2 size={10} className="animate-spin text-emerald-600" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* ── 2. Operator Pool Mode Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isOperatorPool
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Cog size={18} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-800">
                    Operator Pool Mode
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isOperatorPool
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isOperatorPool ? 'Pool Mode Active' : 'Classic Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Allow field supervisors to claim plant and vehicle operators directly from the project operator pool. Includes real-time claiming badges and cross-supervisor conflict protection.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                {isOperatorPool ? 'Active' : 'Disabled'}
              </span>
              <button
                type="button"
                disabled={updatingResource !== null}
                onClick={() => handleToggleMode('operator', !isOperatorPool)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  isOperatorPool ? 'bg-blue-500' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                title={isOperatorPool ? 'Disable Operator Pool Mode' : 'Enable Operator Pool Mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    isOperatorPool ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {updatingResource === 'operator' && (
                    <Loader2 size={10} className="animate-spin text-blue-600" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* ── 3. Equipment Pool Mode Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isEquipmentPool
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Tractor size={18} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-800">
                    Equipment Pool Mode
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isEquipmentPool
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isEquipmentPool ? 'Pool Mode Active' : 'Classic Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Allow supervisors to select and log machinery, vehicles, and equipment directly from the site yard without requiring daily manual pre-assignment by Site Admin.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                {isEquipmentPool ? 'Active' : 'Disabled'}
              </span>
              <button
                type="button"
                disabled={updatingResource !== null}
                onClick={() => handleToggleMode('equipment', !isEquipmentPool)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  isEquipmentPool ? 'bg-amber-500' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                title={isEquipmentPool ? 'Disable Equipment Pool Mode' : 'Enable Equipment Pool Mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    isEquipmentPool ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {updatingResource === 'equipment' && (
                    <Loader2 size={10} className="animate-spin text-amber-600" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
