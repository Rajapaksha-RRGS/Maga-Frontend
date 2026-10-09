/**
 * SABusinessPartnersPage.tsx — Super Admin: Global Business Partner Master
 *
 * Central Corporate Business Partner Directory (MF_G_BUSINESS_PARTNER).
 * Super Admin manages corporate subcontractors, labour suppliers, and service providers.
 * Directly provides "Add BP" creation (no ERP import flow).
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Phone,
  Mail,
  User,
  Star,
  Users,
  Briefcase,
  AlertCircle,
  X,
  UploadCloud,
  MapPin,
} from 'lucide-react';
import api from '../../config/api';
import SACsvImportModal from '../../components/SACsvImportModal';

const BP_SAMPLE_HEADERS = [
  'code',
  'name',
  'type',
  'nicNo',
  'address',
  'city',
  'country',
  'contactPerson',
  'phone',
  'email',
  'rating',
];
const BP_SAMPLE_DATA = [
  {
    code: 'BP1001201',
    name: 'Sierra Construction (Pvt) Ltd',
    type: 'subcontractor',
    nicNo: 'PV-10928',
    address: 'No 23, Station Road',
    city: 'Colombo',
    country: 'Sri Lanka',
    contactPerson: 'Sunil Weerasinghe',
    phone: '011-2808835',
    email: 'info@sierra.lk',
    rating: 'A',
  },
  {
    code: 'BP1020469',
    name: 'Vanitha S Manpower Supply',
    type: 'labour_supplier',
    nicNo: '198425601234',
    address: 'Kandy Road, Kiribathgoda',
    city: 'Gampaha',
    country: 'Sri Lanka',
    contactPerson: 'Vanitha S',
    phone: '077-5767921',
    email: 'vanitha@mail.com',
    rating: 'B',
  },
  {
    code: 'BP1016329',
    name: 'Komatsu Plant & Machinery Hire',
    type: 'equipment_supplier',
    nicNo: '',
    address: 'Industrial Zone',
    city: 'Kurunegala',
    country: 'Sri Lanka',
    contactPerson: 'Arumugam Pillai',
    phone: '077-4557850',
    email: '',
    rating: 'A',
  },
  {
    code: 'BP1009988',
    name: 'Lanka Piling Services',
    type: '', // Optional - can be left blank
    nicNo: 'PV-99011',
    address: 'High Level Road',
    city: 'Nugegoda',
    country: 'Sri Lanka',
    contactPerson: 'D. M. Perera',
    phone: '071-2345678',
    email: 'contact@lankapiling.lk',
    rating: 'A',
  },
];
const BP_REQUIRED_FIELDS = ['code', 'name'];

interface CorporateBusinessPartnerItem {
  id: string;
  code: string;
  name: string;
  type?: string | null;
  nicNo?: string | null;
  businessEntityIdentifier?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  rating?: string | null;
  status: string;
  createdAt: string;
  _count?: {
    corporateEmployees: number;
  };
}

export default function SABusinessPartnersPage() {
  const [partners, setPartners] = useState<CorporateBusinessPartnerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<CorporateBusinessPartnerItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState(''); // Optional!
  const [formNicNo, setFormNicNo] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formCountry, setFormCountry] = useState('Sri Lanka');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRating, setFormRating] = useState('');

  const fetchPartners = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/corporate/business-partners');
      setPartners(res.data?.items ?? []);
    } catch {
      setError('Failed to fetch corporate business partners.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  // Filtered partners
  const filtered = useMemo(() => {
    return partners.filter((bp) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        bp.code.toLowerCase().includes(q) ||
        bp.name.toLowerCase().includes(q) ||
        (bp.nicNo && bp.nicNo.toLowerCase().includes(q)) ||
        (bp.businessEntityIdentifier && bp.businessEntityIdentifier.toLowerCase().includes(q)) ||
        (bp.city && bp.city.toLowerCase().includes(q)) ||
        (bp.contactPerson && bp.contactPerson.toLowerCase().includes(q)) ||
        (bp.phone && bp.phone.includes(q)) ||
        (bp.email && bp.email.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || bp.status === statusFilter;
      const matchType =
        typeFilter === 'all' ||
        (bp.type ? bp.type.toLowerCase() === typeFilter.toLowerCase() : typeFilter === 'unspecified');

      return matchSearch && matchStatus && matchType;
    });
  }, [partners, search, statusFilter, typeFilter]);

  // Aggregate stats
  const totalCount = partners.length;
  const activeCount = partners.filter((p) => p.status === 'active').length;
  const totalEmployeesAttached = partners.reduce(
    (acc, p) => acc + (p._count?.corporateEmployees || 0),
    0,
  );
  const subcontractorCount = partners.filter(
    (p) => !p.type || p.type.toLowerCase().includes('subcontractor'),
  ).length;

  const openAddModal = () => {
    setEditingPartner(null);
    setFormCode('');
    setFormName('');
    setFormType('');
    setFormNicNo('');
    setFormAddress('');
    setFormCity('');
    setFormCountry('Sri Lanka');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormRating('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (bp: CorporateBusinessPartnerItem) => {
    setEditingPartner(bp);
    setFormCode(bp.code);
    setFormName(bp.name);
    setFormType(bp.type || '');
    setFormNicNo(bp.nicNo || bp.businessEntityIdentifier || '');
    setFormAddress(bp.address || '');
    setFormCity(bp.city || '');
    setFormCountry(bp.country || 'Sri Lanka');
    setFormContactPerson(bp.contactPerson || '');
    setFormPhone(bp.phone || '');
    setFormEmail(bp.email || '');
    setFormRating(bp.rating || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Partner Code and Company Name are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formName.trim(),
        type: formType.trim() || undefined,
        nicNo: formNicNo.trim() || undefined,
        businessEntityIdentifier: formNicNo.trim() || undefined,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        country: formCountry.trim() || 'Sri Lanka',
        contactPerson: formContactPerson.trim() || undefined,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        rating: formRating.trim() || undefined,
      };

      if (editingPartner) {
        // Update
        const res = await api.put(`/corporate/business-partners/${editingPartner.id}`, payload);
        if (res.data?.businessPartner) {
          setPartners((prev) =>
            prev.map((p) =>
              p.id === editingPartner.id
                ? { ...p, ...res.data.businessPartner }
                : p,
            ),
          );
        }
      } else {
        // Create
        const res = await api.post('/corporate/business-partners', {
          code: formCode.trim().toUpperCase(),
          ...payload,
        });
        if (res.data?.businessPartner) {
          setPartners((prev) => [
            { ...res.data.businessPartner, _count: { corporateEmployees: 0 } },
            ...prev,
          ]);
        }
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (bp: CorporateBusinessPartnerItem) => {
    const newStatus = bp.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/corporate/business-partners/${bp.id}`, { status: newStatus });
      setPartners((prev) =>
        prev.map((p) => (p.id === bp.id ? { ...p, status: newStatus } : p)),
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update partner status');
    }
  };

  const handleDeletePartner = async (bp: CorporateBusinessPartnerItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${bp.name} (${bp.code})? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/corporate/business-partners/${bp.id}`);
      setPartners((prev) => prev.filter((p) => p.id !== bp.id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete partner');
    }
  };

  return (
    <div className="px-4 md:px-6 py-5 flex flex-col gap-5 min-h-0">
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={22} className="text-[#C9A84C]" />
            <h1 className="text-base font-semibold text-slate-800">
              Corporate Business Partners
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Head Office Global Directory — Manage corporate subcontractors & suppliers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Secondary Action: Bulk Import CSV */}
          <button
            id="sa-bp-import-csv-btn"
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-800 text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud size={15} className="text-[#C9A84C]" />
            <span>Import CSV</span>
          </button>

          {/* Primary Action Button: Add BP (No ERP import) */}
          <button
            id="sa-add-bp-btn"
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span>Add BP</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ── Metric KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-violet-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-[#1A0A2E] flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800 tabular-nums">
              {isLoading ? '—' : totalCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Total Partners</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              {isLoading ? '—' : activeCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Active Partners</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-700 tabular-nums">
              {isLoading ? '—' : subcontractorCount}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Subcontractors</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-100 p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-700 tabular-nums">
              {isLoading ? '—' : totalEmployeesAttached}
            </div>
            <div className="text-[11px] font-medium text-slate-400">Attached Workforce</div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Bar ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by code, company, contact person, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-violet-200 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-violet-50/60 p-0.5 rounded-lg border border-violet-100 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          >
            <option value="all" className="bg-white text-slate-900">All Types</option>
            <option value="subcontractor" className="bg-white text-slate-900">Subcontractor</option>
            <option value="labour_supplier" className="bg-white text-slate-900">Labour Supplier</option>
            <option value="equipment_supplier" className="bg-white text-slate-900">Equipment Supplier</option>
            <option value="specialist" className="bg-white text-slate-900">Specialist Contractor</option>
            <option value="unspecified" className="bg-white text-slate-900">Unspecified / Blank</option>
          </select>
        </div>
      </div>

      {/* ── Business Partner Data Table ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)] min-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-violet-50/95 backdrop-blur-xs z-10">
              <tr className="border-b border-violet-100 bg-violet-50/90">
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  BP Code
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Partner / Company Name
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Contact Person & Phone
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Workforce
                </th>
                <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">
                  Rating
                </th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-40" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-16 mx-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-violet-50 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No Business Partners Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {search
                        ? 'Try clearing your search query'
                        : 'Click "Add BP" above to register your first corporate business partner.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((bp) => (
                  <tr key={bp.id} className="hover:bg-violet-50/30 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3 font-mono font-bold text-violet-700">
                      <span className="bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">
                        {bp.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{bp.name}</div>
                      {(bp.nicNo || bp.businessEntityIdentifier) && (
                        <div className="text-[11px] text-violet-700 font-mono font-medium">
                          NIC / BR: {bp.nicNo || bp.businessEntityIdentifier}
                        </div>
                      )}
                      {bp.email && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail size={11} /> {bp.email}
                        </div>
                      )}
                    </td>

                    {/* Type (Optional) */}
                    <td className="px-4 py-3">
                      {bp.type ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full capitalize">
                          {bp.type.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Optional / None</span>
                      )}
                    </td>

                    {/* Contact Person */}
                    <td className="px-4 py-3">
                      {bp.contactPerson ? (
                        <div className="font-medium text-slate-700 flex items-center gap-1">
                          <User size={11} className="text-slate-400" />
                          {bp.contactPerson}
                        </div>
                      ) : (
                        <div className="text-slate-400">—</div>
                      )}
                      {bp.phone && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone size={10} className="text-slate-400" />
                          {bp.phone}
                        </div>
                      )}
                      {(bp.city || bp.address) && (
                        <div
                          className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[200px]"
                          title={[bp.address, bp.city, bp.country].filter(Boolean).join(', ')}
                        >
                          <MapPin size={10} className="text-[#C9A84C] shrink-0" />
                          <span>{[bp.city, bp.country].filter(Boolean).join(', ') || bp.address}</span>
                        </div>
                      )}
                    </td>

                    {/* Workforce Count */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        <Users size={11} className="text-slate-400" />
                        {bp._count?.corporateEmployees ?? 0}
                      </span>
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3">
                      {bp.rating ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          {bp.rating}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Standard</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(bp)}
                        title="Click to toggle status"
                        className="cursor-pointer"
                      >
                        {bp.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full hover:bg-slate-200 transition-colors">
                            <XCircle size={10} /> Inactive
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(bp)}
                          title="Edit Partner"
                          className="p-1 rounded text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePartner(bp)}
                          title="Delete Partner"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-violet-50 bg-violet-50/30 shrink-0">
            <p className="text-xs text-slate-400">
              {filtered.length} business partner{filtered.length !== 1 ? 's' : ''} in directory
            </p>
          </div>
        )}
      </div>

      {/* ── Add / Edit Business Partner Modal ──────────────────────────── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sa-modal"
          style={{ colorScheme: 'light' }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-violet-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900"
            style={{ colorScheme: 'light' }}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-[#C9A84C]" />
                <h3 className="font-semibold text-sm">
                  {editingPartner ? 'Edit Business Partner' : 'Add Corporate Business Partner (Add BP)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePartner} className="p-5 flex flex-col gap-4 bg-white text-slate-900">
              {formError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Partner Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPartner}
                    placeholder="e.g. BP-001 or MAGA-SUB"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {/* Type (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Partner Type
                    </label>
                    <span className="text-[10px] text-violet-600 font-medium">Optional</span>
                  </div>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="" className="bg-white text-slate-900">— Select Type (Optional) —</option>
                    <option value="subcontractor" className="bg-white text-slate-900">Subcontractor</option>
                    <option value="labour_supplier" className="bg-white text-slate-900">Labour Supplier</option>
                    <option value="equipment_supplier" className="bg-white text-slate-900">Equipment Supplier</option>
                    <option value="specialist" className="bg-white text-slate-900">Specialist Contractor</option>
                    <option value="consultant" className="bg-white text-slate-900">Consultant / Service Provider</option>
                  </select>
                </div>
              </div>

              {/* Company / Partner Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Company / Subcontractor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Colombo Piling & Foundations Ltd"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* NIC / Business Registration (BR / Reg) No */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    NIC / Business Registration (BR) No
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 198512345678, PV-12345, or BR-88214"
                  value={formNicNo}
                  onChange={(e) => setFormNicNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                />
              </div>

              {/* Physical Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Office / Street Address
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. No. 45/A, Nawala Road, Narahenpita"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {/* City & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      City / Town
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Colombo, Kandy, Gampaha"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Country
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Sri Lanka"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Contact Person */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Contact Person
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Mr. K. Silva"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Phone Number
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 077-1234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Email Address
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="email"
                    placeholder="e.g. info@partner.lk"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                {/* Rating / Grade */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Grade / Rating
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Grade A, Class 1, ★★★★★"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-violet-50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    'Saving…'
                  ) : editingPartner ? (
                    'Update Partner'
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Save Business Partner</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Universal CSV Import Modal ──────────────────────────────── */}
      <SACsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Import Corporate Business Partners via CSV"
        entityName="Business Partner"
        endpoint="/corporate/business-partners/bulk-import"
        sampleHeaders={BP_SAMPLE_HEADERS}
        sampleData={BP_SAMPLE_DATA}
        requiredFields={BP_REQUIRED_FIELDS}
        columnLabels={{
          code: 'Partner Code',
          name: 'Company / Partner Name',
          type: 'Partner Type',
          contactPerson: 'Contact Person',
          phone: 'Phone Number',
          email: 'Email Address',
          rating: 'Rating / Grade',
        }}
        onSuccess={() => {
          fetchPartners();
        }}
      />
    </div>
  );
}
