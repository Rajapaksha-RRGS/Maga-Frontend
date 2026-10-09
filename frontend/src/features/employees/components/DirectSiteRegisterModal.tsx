/**
 * DirectSiteRegisterModal.tsx
 *
 * Direct Site Personnel & Subcontractor Registration (Gate Walk-in).
 * Allows Project Sites to register new walk-in personnel and subcontractors
 * immediately so daily attendance and line-ups are not blocked.
 *
 * Requirements:
 * 1. Single combined PDF dossier for Employee (NIC front/back + Birth Certificate).
 * 2. If subcontractor is new: BR Number, Owner NIC, and single combined PDF dossier.
 * 3. Table-driven Trade Group selection (strictly required).
 * 4. Status set to 'pending_approval' with clear payroll lock notification.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building2,
  HardHat,
  ShieldCheck,
  PlusCircle,
  FileCheck2,
} from 'lucide-react';
import api from '../../../config/api';
import type { BusinessPartner } from '../../business-partners/services/businessPartnerService';

interface TradeGroupOption {
  id: string;
  code: string;
  name: string;
  standardDailyRate: number;
}

interface DirectSiteRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingPartners: BusinessPartner[];
}

export default function DirectSiteRegisterModal({
  isOpen,
  onClose,
  onSuccess,
  existingPartners,
}: DirectSiteRegisterModalProps) {
  // Tabs: Worker classification
  const [workerType, setWorkerType] = useState<'internal' | 'external'>('internal');

  // Employee Form State
  const [fullName, setFullName] = useState('');
  const [callingName, setCallingName] = useState('');
  const [nicNo, setNicNo] = useState('');
  const [epfNo, setEpfNo] = useState('');
  const [tradeGroupId, setTradeGroupId] = useState('');
  const [dailyRate, setDailyRate] = useState('1400');
  const [isOperator, setIsOperator] = useState(false);

  // Employee Dossier File
  const [empDocumentFile, setEmpDocumentFile] = useState<File | null>(null);
  const [empDocumentUrl, setEmpDocumentUrl] = useState<string | null>(null);
  const [isUploadingEmpDoc, setIsUploadingEmpDoc] = useState(false);

  // Business Partner State (if External)
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [isNewPartner, setIsNewPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerBrNumber, setNewPartnerBrNumber] = useState('');
  const [newPartnerNicNo, setNewPartnerNicNo] = useState('');
  const [newPartnerContactPerson, setNewPartnerContactPerson] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');

  // Business Partner Dossier File
  const [bpDocumentFile, setBpDocumentFile] = useState<File | null>(null);
  const [bpDocumentUrl, setBpDocumentUrl] = useState<string | null>(null);
  const [isUploadingBpDoc, setIsUploadingBpDoc] = useState(false);

  // Data Loading & State
  const [tradeGroups, setTradeGroups] = useState<TradeGroupOption[]>([]);
  const [isLoadingTradeGroups, setIsLoadingTradeGroups] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Table-Driven Trade Groups from Central Master
  useEffect(() => {
    if (!isOpen) return;
    const fetchTradeGroups = async () => {
      setIsLoadingTradeGroups(true);
      try {
        const res = await api.get('/corporate/trade-groups');
        const groups = (res.data?.items || res.data || []) as TradeGroupOption[];
        setTradeGroups(groups);
        if (groups.length > 0 && !tradeGroupId) {
          setTradeGroupId(groups[0].id);
          setDailyRate(String(groups[0].standardDailyRate || 1400));
        }
      } catch (err) {
        console.error('Failed to load trade groups:', err);
      } finally {
        setIsLoadingTradeGroups(false);
      }
    };
    fetchTradeGroups();
  }, [isOpen]);

  // Handle Trade Group change to auto-suggest daily rate
  const handleTradeGroupChange = (tgId: string) => {
    setTradeGroupId(tgId);
    const selected = tradeGroups.find((tg) => tg.id === tgId);
    if (selected) {
      setDailyRate(String(selected.standardDailyRate || 1400));
      if (selected.name.toLowerCase().includes('operator') || selected.name.toLowerCase().includes('driver')) {
        setIsOperator(true);
      }
    }
  };

  // Upload Document Helper
  const uploadDocument = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('document', file);
    const res = await api.post('/uploads/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.fileUrl;
  };

  // Handle Worker Dossier File Selection
  const handleEmpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmpDocumentFile(file);
    setIsUploadingEmpDoc(true);
    setErrorMessage(null);
    try {
      const url = await uploadDocument(file);
      setEmpDocumentUrl(url);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to upload worker dossier PDF');
      setEmpDocumentFile(null);
    } finally {
      setIsUploadingEmpDoc(false);
    }
  };

  // Handle Business Partner Dossier File Selection
  const handleBpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBpDocumentFile(file);
    setIsUploadingBpDoc(true);
    setErrorMessage(null);
    try {
      const url = await uploadDocument(file);
      setBpDocumentUrl(url);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to upload business partner dossier PDF');
      setBpDocumentFile(null);
    } finally {
      setIsUploadingBpDoc(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFullName('');
    setCallingName('');
    setNicNo('');
    setEpfNo('');
    setDailyRate('1400');
    setIsOperator(false);
    setEmpDocumentFile(null);
    setEmpDocumentUrl(null);
    setSelectedPartnerId('');
    setIsNewPartner(false);
    setNewPartnerName('');
    setNewPartnerBrNumber('');
    setNewPartnerNicNo('');
    setNewPartnerContactPerson('');
    setNewPartnerPhone('');
    setBpDocumentFile(null);
    setBpDocumentUrl(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!callingName.trim() || !fullName.trim()) {
      setErrorMessage('Calling Name and Full Name are strictly required.');
      return;
    }
    if (!nicNo.trim()) {
      setErrorMessage('National Identity Card (NIC) number is strictly required.');
      return;
    }
    if (!tradeGroupId) {
      setErrorMessage('Trade Group is strictly required. Please select a valid trade group.');
      return;
    }

    const selectedTg = tradeGroups.find((tg) => tg.id === tradeGroupId);
    const tradeGroupName = selectedTg?.name || 'General Labour';

    if (workerType === 'external') {
      if (!isNewPartner && !selectedPartnerId) {
        setErrorMessage('Please select an existing Business Partner or enroll a new Subcontractor.');
        return;
      }
      if (isNewPartner && (!newPartnerName.trim() || !newPartnerBrNumber.trim())) {
        setErrorMessage('Subcontractor Name and Business Registration (BR) Number are mandatory.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Prepare submission payload
      const payload: Record<string, any> = {
        fullName: fullName.trim(),
        callingName: callingName.trim(),
        nicNo: nicNo.trim().toUpperCase(),
        epfNo: epfNo.trim() || undefined,
        tradeGroup: tradeGroupName,
        dailyRate: parseFloat(dailyRate) || 1400,
        isOperator,
        employeeType: workerType,
        documentUrl: empDocumentUrl || undefined,
        status: 'pending_approval',
        isSiteWalkIn: true,
      };

      if (workerType === 'external') {
        if (isNewPartner) {
          payload.businessPartnerName = newPartnerName.trim();
          payload.businessPartnerBrNumber = newPartnerBrNumber.trim();
          payload.businessPartnerNicNo = newPartnerNicNo.trim() || undefined;
          payload.businessPartnerDocumentUrl = bpDocumentUrl || undefined;
        } else {
          payload.businessPartnerId = selectedPartnerId;
          const matched = existingPartners.find((p) => p.id === selectedPartnerId);
          if (matched) {
            payload.businessPartner = matched.name;
            payload.businessPartnerCode = matched.code;
          }
        }
      }

      // 2. Submit to backend
      await api.post('/employees', payload);

      // 3. Complete and notify
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Direct site registration failed:', err);
      setErrorMessage(
        err.response?.data?.error || 'Registration failed. Please verify the information and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10">
              <UserPlus className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Direct Site Registration (Walk-in)</h2>
                {/* <span className="text-[11px] font-semibold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Gate Walk-in
                </span> */}
              </div>
              
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Worker Classification Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              1. Worker Classification
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setWorkerType('internal');
                  setIsNewPartner(false);
                }}
                className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  workerType === 'internal'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <HardHat className="w-4 h-4 text-blue-600" />
                <span>Direct Mäga (Internal)</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkerType('external')}
                className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  workerType === 'external'
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Subcontractor (External)</span>
              </button>
            </div>
          </div>

          {/* Subcontractor / Business Partner Section (If External) */}
          {workerType === 'external' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Building2 size={15} className="text-indigo-600" />
                  <span>Subcontractor Details</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewPartner(!isNewPartner)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={13} />
                  <span>{isNewPartner ? 'Select Existing Subcontractor' : '+ Register New Subcontractor'}</span>
                </button>
              </div>

              {!isNewPartner ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Select Registered Business Partner <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-medium"
                  >
                    <option value="">-- Choose Subcontractor / Labour Supplier --</option>
                    {existingPartners.map((bp) => (
                      <option key={bp.id} value={bp.id}>
                        {bp.code} — {bp.name} {bp.status === 'pending_approval' ? '⚠️ (Pending HO Approval)' : ''}
                      </option>
                    ))}
                  </select>
                  {existingPartners.find((p) => p.id === selectedPartnerId)?.status === 'pending_approval' && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong>Subcontractor Pending HO Approval:</strong> This partner is awaiting Super Admin verification. You can enroll this worker now, but payroll disbursement will be held until both the worker and subcontractor are approved.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Subcontractor Legal Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                        placeholder="e.g. Sierra Construction / Kandy Masons"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Business Reg (BR) Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPartnerBrNumber}
                        onChange={(e) => setNewPartnerBrNumber(e.target.value)}
                        placeholder="e.g. PV12345 or W/2021"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Owner NIC Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPartnerNicNo}
                        onChange={(e) => setNewPartnerNicNo(e.target.value)}
                        placeholder="e.g. 741230456V"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={newPartnerContactPerson}
                        onChange={(e) => setNewPartnerContactPerson(e.target.value)}
                        placeholder="Name of owner/lead"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={newPartnerPhone}
                        onChange={(e) => setNewPartnerPhone(e.target.value)}
                        placeholder="077-xxxxxxx"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Subcontractor Dossier Upload */}
                  <div className="p-3 bg-white border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                        <FileCheck2 size={14} className="text-indigo-600" />
                        <span>Subcontractor Dossier (Combined PDF Scan)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">BR Certificate + Owner NIC</span>
                    </div>
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50/50 cursor-pointer transition-colors text-xs text-indigo-700">
                      <Upload size={14} />
                      <span>{bpDocumentFile ? bpDocumentFile.name : 'Select Combined BR & NIC PDF'}</span>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleBpFileChange}
                        className="hidden"
                      />
                    </label>
                    {isUploadingBpDoc && (
                      <p className="text-[11px] text-blue-600 font-medium mt-1">Uploading subcontractor dossier...</p>
                    )}
                    {bpDocumentUrl && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium mt-1">
                        <CheckCircle2 size={13} />
                        <span>Subcontractor dossier attached successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              )} 
            </div>
          )}  

          {/* Personnel Information Section */}
          <div className="space-y-3.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Personnel Information
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Kamal Piyasena Weerasinghe"
                  className="w-full px-3 py-2 text-xs text-black bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Calling Name / Short Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={callingName}
                  onChange={(e) => setCallingName(e.target.value)}
                  placeholder="e.g. Kamal"
                  className="w-full px-3 py-2 text-xs text-black bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  National ID Card (NIC) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nicNo}
                  onChange={(e) => setNicNo(e.target.value)}
                  placeholder="e.g. 199120405123 or 882103412V"
                  className="w-full px-3 py-2 text-xs text-black bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">EPF No (Optional)</label>
                <input
                  type="text"
                  value={epfNo}
                  onChange={(e) => setEpfNo(e.target.value)}
                  placeholder="e.g. 89201"
                  className="w-full px-3 py-2 text-xs text-black bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Trade Group <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={tradeGroupId}
                  onChange={(e) => handleTradeGroupChange(e.target.value)}
                  disabled={isLoadingTradeGroups}
                  className="w-full px-3 py-2 text-xs text-red border  rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                >
                  {isLoadingTradeGroups ? (
                    <option value="">Loading Trade Groups from Master...</option>
                  ) : (
                    tradeGroups.map((tg) => (
                      <option key={tg.id} value={tg.id}>
                        {tg.code} — {tg.name} (Std LKR {tg.standardDailyRate})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Daily Rate (LKR) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">LKR</span>
                  <input
                    type="number"
                    step="50"
                    required
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="site-op-checkbox"
                checked={isOperator}
                onChange={(e) => setIsOperator(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="site-op-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                This worker is an Equipment Operator / Heavy Machinery Driver
              </label>
            </div>
          </div>

          {/* Combined Dossier Upload Section */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <FileText size={15} className="text-blue-700" />
                <span>3. Worker Identity Dossier (Single Combined PDF)</span>
              </span>
              
            </div>
            <p className="text-[11px] text-slate-600">
              Upload the field scan combining worker NIC (front/back) and Birth Certificate into 1 PDF document.
            </p>

            <label className="flex items-center justify-center gap-2.5 p-3.5 border-2 border-dashed border-blue-300 rounded-xl hover:bg-blue-100/50 cursor-pointer transition-colors text-xs text-blue-800 font-medium">
              <Upload size={16} />
              <span>{empDocumentFile ? empDocumentFile.name : 'Choose Combined Identity PDF Scan'}</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleEmpFileChange}
                className="hidden"
              />
            </label>

            {isUploadingEmpDoc && (
              <p className="text-[11px] text-blue-700 font-medium">Uploading worker dossier scan...</p>
            )}
            {empDocumentUrl && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mt-1">
                <CheckCircle2 size={13} />
                <span>Worker dossier uploaded & ready for verification</span>
              </div>
            )}
          </div>

          {/* 2-Tier Approval & Payroll Lock Notice */}
          {/* <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">2-Tier Approval Policy & Payroll Disbursement Lock:</span>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Worker will immediately receive provisional code <span className="font-mono font-bold">PRJ-TMP-xxx</span> so daily attendance and site line-up can be logged today without delay.
                However, <strong>payout / salary disbursement is locked</strong> until Head Office Super Admin verifies credentials and issues official permanent numbers.
              </p>
            </div>
          </div> */}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingEmpDoc || isUploadingBpDoc}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting to Head Office...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Enroll Personnel (Pending HO Approval)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
