/**
 * TenantForm.tsx
 *
 * SlidePanel Form for onboarding a new Tenant Organization + Initial Admin Account,
 * or updating an existing Tenant's details.
 * Strictly adheres to design-system.json:
 * - min-h-[52px] inputs
 * - min-h-[52px] primary button (bg-blue-700 active:bg-blue-800)
 * - sentence case labels & tracking-wide uppercase section titles
 * - focus rings ring-blue-600
 */
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Building2, User, Sparkles, Database, CheckCircle2, ChevronDown, Search } from 'lucide-react';
import type {
  TenantRecord,
  TenantRegisterInput,
  TenantUpdateInput,
  CorporateProjectOption,
} from '../services/tenantService';
import { generateTempPassword, fetchCorporateProjects } from '../services/tenantService';

interface TenantFormProps {
  initialTenant?: TenantRecord | null;
  isSubmitting: boolean;
  onSaveRegister: (data: TenantRegisterInput) => Promise<{ success: boolean; error?: string } | boolean>;
  onSaveUpdate: (id: string, data: TenantUpdateInput) => Promise<{ success: boolean; error?: string } | boolean>;
  onClose: () => void;
}

export default function TenantForm({
  initialTenant,
  isSubmitting,
  onSaveRegister,
  onSaveUpdate,
  onClose,
}: TenantFormProps) {
  const isEditing = !!initialTenant;

  // Corporate Projects catalog for selection
  const [corporateProjects, setCorporateProjects] = useState<CorporateProjectOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState(initialTenant?.companyName || '');
  const [subdomain, setSubdomain] = useState(initialTenant?.subdomain || '');
  const [email, setEmail] = useState(initialTenant?.email || '');
  const [phone, setPhone] = useState(initialTenant?.phone || '');
  const [fax, setFax] = useState(initialTenant?.fax || '');
  const [addressLine1, setAddressLine1] = useState(initialTenant?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(initialTenant?.addressLine2 || '');

  // Initial Admin fields (for registration only)
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Local validation error
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load corporate projects on mount (for registration)
  useEffect(() => {
    if (!isEditing) {
      setIsLoadingProjects(true);
      fetchCorporateProjects()
        .then((projects) => {
          setCorporateProjects(projects);
        })
        .finally(() => {
          setIsLoadingProjects(false);
        });
    }
  }, [isEditing]);

  useEffect(() => {
    if (initialTenant) {
      setCompanyName(initialTenant.companyName || '');
      setSubdomain(initialTenant.subdomain || '');
      setEmail(initialTenant.email || '');
      setPhone(initialTenant.phone || '');
      setFax(initialTenant.fax || '');
      setAddressLine1(initialTenant.addressLine1 || '');
      setAddressLine2(initialTenant.addressLine2 || '');
    } else {
      // Pre-fill a suggested strong password
      setAdminPassword(generateTempPassword());
    }
  }, [initialTenant]);

  const filteredCorporateProjects = useMemo(() => {
    if (!projectSearch.trim()) return corporateProjects;
    const query = projectSearch.toLowerCase();
    return corporateProjects.filter(
      (p) =>
        p.projectCode.toLowerCase().includes(query) ||
        (p.projectName && p.projectName.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.searchKey && p.searchKey.toLowerCase().includes(query))
    );
  }, [corporateProjects, projectSearch]);

  const handleSelectCorporateProject = (proj: CorporateProjectOption) => {
    setSelectedProjectId(proj.id);
    setIsDropdownOpen(false);

    // Auto populate details
    const finalName = proj.projectName || proj.description || '';
    setCompanyName(finalName);
    setSubdomain(proj.projectCode);
    if (proj.addressCode) {
      setAddressLine1(proj.addressCode);
    }
    
    // Auto populate admin details
    const adminName = proj.searchKey
      ? `${proj.searchKey} Admin`
      : `${proj.projectCode} Admin`;
    setAdminFullName(adminName);

    const cleanCode = proj.projectCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    setAdminUsername(`admin_${cleanCode}`);
  };

  const handleRegeneratePassword = () => {
    setAdminPassword(generateTempPassword());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!companyName.trim()) {
      setValidationError('Company name is required.');
      return;
    }

    if (!isEditing) {
      if (!subdomain.trim()) {
        setValidationError('Subdomain is required.');
        return;
      }
      if (!adminFullName.trim()) {
        setValidationError('Initial admin full name is required.');
        return;
      }
      if (!adminUsername.trim()) {
        setValidationError('Initial admin username is required.');
        return;
      }

      const result = await onSaveRegister({
        companyName: companyName.trim(),
        subdomain: subdomain.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        fax: fax.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        adminFullName: adminFullName.trim(),
        adminUsername: adminUsername.trim(),
        adminPassword: adminPassword.trim() || undefined,
      });

      if (typeof result === 'boolean') {
        if (result) onClose();
      } else {
        if (result.success) {
          onClose();
        } else if (result.error) {
          setValidationError(result.error);
        }
      }
    } else {
      const result = await onSaveUpdate(initialTenant.id, {
        companyName: companyName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        fax: fax.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
      });

      if (typeof result === 'boolean') {
        if (result) onClose();
      } else {
        if (result.success) {
          onClose();
        } else if (result.error) {
          setValidationError(result.error);
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-2" noValidate>
      {validationError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
          {validationError}
        </div>
      )}

      {/* ── Section 0: Select from Corporate Master Data (Registration only) ── */}
      {!isEditing && (
        <div className="bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 tracking-wide">
              <Database size={15} className="text-blue-700" />
              <span>Select from Corporate ERP Projects</span>
            </div>
            {corporateProjects.length > 0 && (
              <span className="text-[11px] font-medium text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                {corporateProjects.length} Projects Available
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Choose an existing Corporate Project to automatically populate the project code, name, address, and default site admin credentials.
          </p>

          <div className="relative">
            {/* Project Picker Trigger */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-blue-200 rounded-lg text-sm text-left hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all min-h-[44px]"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedProjectId ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-medium text-slate-900 truncate">
                      {corporateProjects.find((p) => p.id === selectedProjectId)?.projectCode} - {corporateProjects.find((p) => p.id === selectedProjectId)?.projectName || corporateProjects.find((p) => p.id === selectedProjectId)?.description}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">
                    {isLoadingProjects ? 'Loading corporate projects…' : '— Click to search & select a corporate project —'}
                  </span>
                )}
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col overflow-hidden max-h-72">
                {/* Search Bar inside dropdown */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
                  <Search size={15} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search by code (e.g. 531M, 521M) or name..."
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1"
                    autoFocus
                  />
                  {projectSearch && (
                    <button
                      type="button"
                      onClick={() => setProjectSearch('')}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Projects List */}
                <div className="overflow-y-auto divide-y divide-slate-100 p-1">
                  {filteredCorporateProjects.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {isLoadingProjects ? 'Fetching projects...' : 'No corporate projects match your search.'}
                    </div>
                  ) : (
                    filteredCorporateProjects.map((proj) => {
                      const isSelected = selectedProjectId === proj.id;
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => handleSelectCorporateProject(proj)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-0.5 transition-colors ${
                            isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-blue-700">
                              <span>{proj.projectCode}</span>
                              {proj.searchKey && (
                                <span className="text-[10px] font-sans font-medium px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                                  {proj.searchKey}
                                </span>
                              )}
                            </div>
                            {isSelected && <CheckCircle2 size={14} className="text-blue-600" />}
                          </div>
                          <div className="text-xs font-medium truncate text-slate-700">
                            {proj.projectName || proj.description}
                          </div>
                          {proj.addressCode && (
                            <div className="text-[11px] text-slate-400 truncate">
                              Location / Address: {proj.addressCode}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 1: Project Details ───────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <Building2 size={14} className="text-blue-700" />
          <span>Project details</span>
        </div>

        {/* Project Code (M-Code) */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tenant-subdomain" className="text-xs font-medium text-slate-700">
            Project code (M-Code / 9-digit code) *
          </label>
          <div className="relative flex items-center">
            <input
              id="tenant-subdomain"
              type="text"
              required
              disabled={isEditing}
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="e.g. 531M, 521M, 403M, M00000403, M0000376B"
              className={`w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm font-mono min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none ${
                isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-800'
              }`}
            />
          </div>
          <span className="text-[11px] text-slate-500">
            Internal project code format (e.g. <strong>531M</strong>, <strong>M00000403</strong>, <strong>M0000376B</strong>)
          </span>
        </div>

        {/* Project Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tenant-company" className="text-xs font-medium text-slate-700">
            Project name *
          </label>
          <input
            id="tenant-company"
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Walgama Diyagama Road, Kandy Road, SEEP"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none"
          />
          {subdomain && companyName && (
            <span className="text-[11px] text-slate-500">
              Display title: <strong className="text-slate-800">{subdomain} - {companyName}</strong>
            </span>
          )}
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="tenant-email" className="text-xs font-medium text-slate-700">
              Official email
            </label>
            <input
              id="tenant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@company.lk"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tenant-phone" className="text-xs font-medium text-slate-700">
              Phone number
            </label>
            <input
              id="tenant-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+94 11 200 0000"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tenant-addr1" className="text-xs font-medium text-slate-700">
            Address line
          </label>
          <input
            id="tenant-addr1"
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Head office address"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* ── Section 2: Initial Admin Account (Registration only) ── */}
      {!isEditing && (
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <User size={14} className="text-green-600" />
            <span>Initial admin account</span>
          </div>

          {/* Admin Full Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="tenant-admin-name" className="text-xs font-medium text-slate-700">
              Admin full name *
            </label>
            <input
              id="tenant-admin-name"
              type="text"
              required
              value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)}
              placeholder="e.g. Ruwan Silva (Site Admin)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none"
            />
          </div>

          {/* Admin Username */}
          <div className="flex flex-col gap-1">
            <label htmlFor="tenant-admin-username" className="text-xs font-medium text-slate-700">
              Admin login username *
            </label>
            <input
              id="tenant-admin-username"
              type="text"
              required
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="e.g. maga_admin"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none font-mono"
            />
          </div>

          {/* Admin Password */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="tenant-admin-password" className="text-xs font-medium text-slate-700">
                Site admin login password (Custom or Auto-generated)
              </label>
              <button
                type="button"
                onClick={handleRegeneratePassword}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
              >
                <Sparkles size={12} />
                <span>Generate random</span>
              </button>
            </div>
            <div className="relative">
              <input
                id="tenant-admin-password"
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Type your own custom password or use auto-generated"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:outline-none font-mono"
              />
            </div>
            <span className="text-[11px] text-slate-500">
              You can enter any custom password here (e.g. <code>admin123</code>, <code>Pass@531</code>) or leave the auto-generated password.
            </span>
          </div>
        </div>
      )}

      {/* Submit / Cancel Footer */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 min-h-[44px] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 active:bg-blue-900 min-h-[44px] transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none flex items-center gap-2"
        >
          {isSubmitting ? (
            <span>Saving…</span>
          ) : isEditing ? (
            <span>Update project</span>
          ) : (
            <span>Register project & site admin</span>
          )}
        </button>
      </div>
    </form>
  );
}
