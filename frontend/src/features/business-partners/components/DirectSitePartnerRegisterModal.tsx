/**
 * DirectSitePartnerRegisterModal.tsx — Site-Level Subcontractor Walk-In Registration
 *
 * Allows Site Admin / Clerks to register a walk-in subcontractor or labour supplier
 * directly from the Business Partners page at the project site gate.
 *
 * Generates provisional code (BP-TMP-xxxx), sets status to 'pending_approval',
 * and requires mandatory Business Registration (BR) number and combined PDF verification dossier.
 */
import React, { useState } from 'react';
import {
  Building2,
  X,
  Upload,
  FileCheck2,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import api from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
import type { BusinessPartner } from '../services/businessPartnerService';

interface DirectSitePartnerRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPartner: BusinessPartner) => void;
}

export default function DirectSitePartnerRegisterModal({
  isOpen,
  onClose,
  onSuccess,
}: DirectSitePartnerRegisterModalProps) {
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('subcontractor');
  const [brNumber, setBrNumber] = useState('');
  const [nicNo, setNicNo] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  // Dossier PDF Upload State
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setType('subcontractor');
    setBrNumber('');
    setNicNo('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setDocumentFile(null);
    setDocumentUrl(null);
    setErrorMessage(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMessage('Please upload a PDF document containing the BR Certificate and Owner NIC.');
      return;
    }

    setDocumentFile(file);
    setIsUploadingDoc(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      const res = await api.post('/uploads/document', formData);
      setDocumentUrl(res.data.url || res.data.fileUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload document dossier');
      setDocumentFile(null);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!name.trim()) {
      setErrorMessage('Company / Subcontractor Legal Name is required.');
      return;
    }
    if (!brNumber.trim()) {
      setErrorMessage('Business Registration (BR) Number is strictly required.');
      return;
    }
    if (!nicNo.trim()) {
      setErrorMessage('Owner / Principal NIC Number is strictly required.');
      return;
    }
    if (!contactPerson.trim() || !phone.trim()) {
      setErrorMessage('Contact Person and Phone Number are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post('/business-partners', {
        name: name.trim(),
        type,
        brNumber: brNumber.trim().toUpperCase(),
        nicNo: nicNo.trim().toUpperCase(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        documentUrl: documentUrl || undefined,
        status: 'pending_approval',
      });

      const created = res.data as BusinessPartner;
      cacheManager.invalidate('business-partners');
      resetForm();
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to register subcontractor:', err);
      setErrorMessage(
        err.message || 'Failed to register subcontractor at site gate.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      style={{ colorScheme: 'light' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
        style={{ colorScheme: 'light' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A0A2E] via-[#2D1055] to-[#1A0A2E] text-white p-5 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Building2 size={18} />
              </span>
              <h2 className="text-base font-bold tracking-tight text-white">
                Direct Site Subcontractor Registration
              </h2>
            </div>
            <p className="text-xs text-slate-300">
              Enroll a walk-in labour supplier or subcontractor entity at the project site gate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2 animate-shake">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dual Approval & Payment Hold Policy Notice */}
          {/* <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-[11px] uppercase tracking-wide text-amber-800">
                Dual Approval & Strict Payroll Lock:
              </span>
              <p className="leading-relaxed text-[11px] text-amber-900">
                Enrolling here assigns a provisional code (<code>BP-TMP-xxxx</code>). You will immediately be able
                to attach external workers under this partner and log their site attendance. However,{' '}
                <strong>partner billing and worker payroll disbursement remain locked</strong> until Head Office Super Admin
                reviews the verification dossier and issues an official code (<code>BP102xxxx</code>).
              </p>
            </div>
          </div> */}

          {/* Subcontractor Entity Details */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Subcontractor Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sierra Construction / Kandy Earthmovers"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Partner Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none font-medium text-slate-800"
                >
                  <option value="subcontractor">Subcontractor</option>
                  <option value="labour_supplier">Labour Supplier</option>
                  <option value="specialist">Specialist Contractor</option>
                  <option value="equipment_supplier">Equipment Supplier</option>
                </select>
              </div>
            </div>

            {/* Legal Identification: BR & Owner NIC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Registration (BR) Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={brNumber}
                  onChange={(e) => setBrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. PV-12345 or BR-88214"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Owner / Principal NIC Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nicNo}
                  onChange={(e) => setNicNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 198512345678 or 741230456V"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none font-mono uppercase"
                />
              </div>
            </div>

            {/* Verification Dossier (Single Combined PDF) */}
            <div className="p-3.5 bg-violet-50/50 border border-violet-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                  <FileCheck2 size={15} className="text-violet-700" />
                  <span>Legal Verification Dossier (Single Combined PDF)</span>
                </span>
                <span className="text-[10px] text-violet-600 font-medium bg-violet-100 px-2 py-0.5 rounded-full">
                  BR Certificate + Owner NIC
                </span>
              </div>

              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-violet-200 hover:border-violet-300 rounded-lg hover:bg-violet-50/70 cursor-pointer transition-colors text-xs text-violet-800 bg-white">
                <Upload size={14} />
                <span>
                  {isUploadingDoc
                    ? 'Uploading PDF dossier…'
                    : documentFile
                      ? documentFile.name
                      : 'Select Scanned PDF Dossier'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  disabled={isUploadingDoc}
                  className="hidden"
                />
              </label>

              {documentUrl && (
                <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    <span className="truncate font-medium">Dossier PDF Attached</span>
                  </div>
                  <a
                    href={
                      documentUrl.startsWith('http')
                        ? documentUrl
                        : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${
                            documentUrl.startsWith('/') ? '' : '/'
                          }${documentUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet-700 hover:underline font-semibold text-[11px] shrink-0"
                  >
                    <FileText size={12} />
                    <span>View</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>

            {/* Key Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Person / Site Representative <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Sunil Weerasinghe"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 077-1234567"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@sierra.lk"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City / Town (Optional)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Colombo, Kandy"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office / Site Address (Optional)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. No 23, Station Road, Colombo"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingDoc}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#1A0A2E] to-[#2D1055] hover:opacity-90 rounded-lg shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
            >
              <Briefcase size={14} />
              <span>{isSubmitting ? 'Enrolling Subcontractor…' : 'Enroll Subcontractor (Pending HO)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
