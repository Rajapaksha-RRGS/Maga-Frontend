/**
 * AdminSettingsPage.tsx — Site Admin Settings
 *
 * Operational and site configuration for the Site Admin:
 *  - Equipment Assignment Mode: Site Pool (Supervisor Self-Assign) vs Classic Admin Pre-Assignment
 *  - Site profile and active project parameters
 */
import { useState, useEffect } from 'react';
import {
  Settings,
  Tractor,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import {
  getTenantById,
  updateEquipmentAssignMode,
  fetchCorporateProjects,
  type CorporateProjectOption,
  type TenantRecord,
} from '../features/tenants/services/tenantService';
import { notifyPoolModeChanged } from '../features/assignments/hooks/useEquipmentPoolMode';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [project, setProject] = useState<TenantRecord | null>(null);
  const [corporateProjects, setCorporateProjects] = useState<CorporateProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(user?.tenantId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
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

  const handleModeChange = async (enablePoolMode: boolean) => {
    if (!selectedProjectId || isUpdating) return;
    setIsUpdating(true);
    setSuccessToast(null);
    setErrorToast(null);

    try {
      await updateEquipmentAssignMode(selectedProjectId, enablePoolMode);
      notifyPoolModeChanged(selectedProjectId, enablePoolMode);
      setProject((prev) =>
        prev ? { ...prev, equipmentAssignBySupervisor: enablePoolMode } : null
      );
      setSuccessToast(
        enablePoolMode
          ? 'Site Pool Mode Enabled: Supervisors can now pick machinery directly from the site yard.'
          : 'Classic Admin Pre-Assign Enforced: Supervisors must be pre-assigned equipment daily.'
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to update equipment assignment mode.');
    } finally {
      setIsUpdating(false);
    }
  };

  const isPoolMode = !!project?.equipmentAssignBySupervisor;

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
              Configure operational dispatch rules and machinery assignment policies for this project site.
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
          {/* ── Equipment Pool Mode Setting Card ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isPoolMode
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
                      isPoolMode
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isPoolMode ? 'Pool Mode Active' : 'Classic Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                  Allow supervisors to select machinery directly from the site yard pool (via <strong>&quot;+ Add from Pool&quot;</strong>). When disabled, Site Admin must assign equipment daily.
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                {isPoolMode ? 'Active' : 'Disabled'}
              </span>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleModeChange(!isPoolMode)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                  isPoolMode ? 'bg-amber-500' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                title={isPoolMode ? 'Disable Site Pool Mode' : 'Enable Site Pool Mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    isPoolMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {isUpdating && (
                    <Loader2 size={10} className="animate-spin text-amber-600" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* More settings can be added here easily as additional compact cards */}
        </div>
      )}
    </div>
  );
}
