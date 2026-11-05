import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  ShieldCheck,
  Loader2,
  Phone,
  Globe,
  MapPin,
  Award,
} from 'lucide-react';
import { getApiBaseUrl } from '../config/api';

interface TransferData {
  id: string;
  startDate: string;
  remarks?: string;
  status: string;
  corporateEmployee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    nicNo: string;
    tradeGroup?: { name: string };
  };
  fromProject?: {
    id: string;
    projectCode: string;
    projectName: string;
  };
  toProject?: {
    id: string;
    projectCode: string;
    projectName: string;
  };
}

export default function TransferReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<TransferData | null>(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedMessage, setProcessedMessage] = useState('');

  // Form states
  const [effectiveReleaseDate, setEffectiveReleaseDate] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Decline states
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const apiUrl = getApiBaseUrl();

  useEffect(() => {
    if (!token) {
      setError('Authorization token is missing. Please check your email link.');
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${apiUrl}/corporate/transfers/verify-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Invalid or expired authorization link.');
          return;
        }

        if (data.isProcessed) {
          setIsProcessed(true);
          setProcessedMessage(data.message || 'This transfer request has already been processed.');
          setTransfer(data.transfer);
          return;
        }

        setTransfer(data.transfer);
        const reqDate = data.transfer?.startDate
          ? data.transfer.startDate.split('T')[0]
          : new Date().toISOString().split('T')[0];
        setEffectiveReleaseDate(reqDate);
      } catch (err: any) {
        setError(err.message || 'Unable to connect to the MAGA mobilization server.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token, apiUrl]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/corporate/transfers/approve-by-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          effectiveReleaseDate: effectiveReleaseDate || undefined,
          releaseRemarks: releaseRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve transfer.');
      }

      setSuccessMessage(
        `Personnel ${transfer?.corporateEmployee?.fullName || ''} has been successfully released and mobilized effective ${effectiveReleaseDate}. Auto-transfer complete.`
      );
    } catch (err: any) {
      alert(err.message || 'Error executing transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/corporate/transfers/reject-by-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reason: declineReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline transfer.');
      }

      setProcessedMessage('Transfer request has been successfully declined.');
      setIsProcessed(true);
    } catch (err: any) {
      alert(err.message || 'Error declining transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans antialiased flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto space-y-4">
        {/* MAGA Corporate Banner Header */}
        <div className="bg-gradient-to-r from-[#002B49] via-[#00223A] to-[#001728] text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-black tracking-widest text-white flex items-center gap-1.5">
                <span>MAGA</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#E5A93C]"></span>
              </div>
              <div className="text-[10px] font-semibold text-[#E5A93C] tracking-wider uppercase mt-0.5">
                MAGA Engineering (Pvt) Ltd
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-amber-400/15 text-amber-300 border border-amber-400/30">
              <ShieldCheck size={13} className="text-amber-400" />
              <span>1-Click Authorization</span>
            </span>
          </div>
          <div className="h-px bg-white/10 my-3.5"></div>
          <h1 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2 tracking-tight">
            <ArrowRightLeft size={16} className="text-[#E5A93C] flex-shrink-0" />
            <span>Inter-Site Personnel Transfer Clearance</span>
          </h1>
          <p className="text-[11px] text-slate-300/90 mt-1">
            Site Mobilization &amp; Effective Release Authorization Portal
          </p>
        </div>

        {/* Loading Screen */}
        {isLoading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-xs border border-slate-200/80">
            <Loader2 size={30} className="animate-spin text-blue-700 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-700 tracking-tight">Verifying authorization token…</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Connecting to MAGA mobilization ledger</p>
          </div>
        )}

        {/* Error Screen */}
        {!isLoading && error && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-xs border border-red-200">
            <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto mb-3 border border-red-200">
              <XCircle size={24} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Authorization Link Unavailable</h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto mb-4">{error}</p>
            <p className="text-[11px] text-slate-400 italic">
              Please contact Central HR or the requesting Project Manager to re-issue the transfer request.
            </p>
          </div>
        )}

        {/* Already Processed Screen */}
        {!isLoading && !error && isProcessed && !successMessage && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-xs border border-slate-200/80 space-y-4">
            <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center text-blue-700 mx-auto border border-blue-200">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Transfer Already Processed</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{processedMessage}</p>
            </div>
            {transfer && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs text-slate-700 space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium">Personnel:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {transfer.corporateEmployee?.fullName} ({transfer.corporateEmployee?.employeeCode})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Status:</span>{' '}
                  <span className="font-semibold uppercase text-blue-700">{transfer.status}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Screen after Confirmation */}
        {successMessage && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-xs border border-emerald-200 space-y-4 animate-in fade-in">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto border border-emerald-200">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Personnel Mobilization Confirmed!</h2>
              <p className="text-xs text-emerald-800 bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 mt-2 text-left leading-relaxed">
                {successMessage}
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              The employee has been automatically deactivated at your station and enrolled into the destination project roster. Both Project Managers have been notified via confirmation email.
            </p>
          </div>
        )}

        {/* Active Review & Approval Form */}
        {!isLoading && !error && !isProcessed && !successMessage && transfer && (
          <form onSubmit={handleApprove} className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-3.5">
            {/* Personnel Details Card */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <User size={12} className="text-slate-400" />
                <span>Personnel Identification</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/70">
                <div className="font-semibold text-slate-900 text-sm">
                  {transfer.corporateEmployee?.fullName}
                </div>
                <span className="font-mono text-[11px] bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-semibold">
                  {transfer.corporateEmployee?.employeeCode}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-0.5">
                <div>
                  <span className="text-slate-400 text-[11px]">Designation:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {transfer.corporateEmployee?.tradeGroup?.name || 'General Labour'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">NIC:</span>{' '}
                  <span className="font-semibold text-slate-800">{transfer.corporateEmployee?.nicNo || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Transfer Station Route */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={12} className="text-slate-400" />
                <span>Mobilization Stations</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Releasing Station (From):</span>
                  <span className="font-semibold text-amber-900">
                    {transfer.fromProject?.projectName || transfer.fromProject?.projectCode}
                  </span>
                </div>
                <ArrowRightLeft size={14} className="text-slate-400 hidden sm:block flex-shrink-0" />
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Destination Station (To):</span>
                  <span className="font-semibold text-blue-800">
                    {transfer.toProject?.projectName || transfer.toProject?.projectCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Requested Mobilization Timeline Card */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-700" />
                  <span>Requested Mobilization Date</span>
                </span>
                <span className="font-bold text-amber-950 bg-amber-100/90 px-2.5 py-0.5 rounded-md border border-amber-300/80 text-[11px]">
                  {transfer.startDate
                    ? new Date(transfer.startDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Not specified'}
                </span>
              </div>
              {transfer.remarks && (
                <div className="text-[11px] text-amber-900/90 italic pt-1 border-t border-amber-200/60">
                  Scope: "{transfer.remarks}"
                </div>
              )}
            </div>

            {/* Releasing PM Input Section */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Actual Effective Release Date (ඔබට සැබවින්ම මුදාහළ හැකි දිනය) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={effectiveReleaseDate}
                    onChange={(e) => setEffectiveReleaseDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white font-medium text-slate-800"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Worker will be automatically enrolled at the destination project roster starting on this date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Release / Handover Remarks (සටහන් / Gate Pass අංකය):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Released with gate pass #GP-891."
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-slate-800"
                />
              </div>
            </div>

            {/* Action Buttons */}
            {!showDeclineForm ? (
              <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDeclineForm(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Decline Request
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !effectiveReleaseDate}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Processing Auto-Transfer…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm &amp; Auto-Transfer</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Decline Form */
              <div className="pt-3 border-t border-red-200/80 space-y-2 bg-red-50/50 p-3 rounded-xl border border-red-200">
                <label className="block text-xs font-semibold text-red-900">
                  Reason for Declining (ප්‍රතික්ෂේප කිරීමට හේතුව):
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Worker currently required for ongoing critical site works."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-red-300 focus:outline-hidden focus:ring-2 focus:ring-red-600 bg-white text-slate-800"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowDeclineForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-white cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !declineReason.trim()}
                    onClick={handleDecline}
                    className="px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting…' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── Official MAGA Corporate Footer ─────────────────────────────────── */}
      <footer className="max-w-xl w-full mx-auto mt-8 pt-6 border-t border-slate-300/70 text-slate-500 text-[11px] space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-800 tracking-wider text-xs">MAGA</span>
            <span className="text-slate-400">&bull;</span>
            <span className="font-semibold text-slate-700">MAGA ENGINEERING (PVT) LTD</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
            <Award size={12} className="text-[#E5A93C]" />
            <span>ISO 9001 &bull; ISO 14001 &bull; ISO 45001 Certified</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500 pt-1">
          <div className="flex items-center gap-1 text-slate-600">
            <MapPin size={11} className="text-slate-400 flex-shrink-0" />
            <span>Head Office: 200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Phone size={11} className="text-slate-400" /> +94 11 280 8835
            </span>
            <a
              href="https://www.maga.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-700 hover:underline font-medium"
            >
              <Globe size={11} /> www.maga.lk
            </a>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center sm:text-left pt-1 border-t border-slate-200/60 leading-normal">
          &copy; {new Date().getFullYear()} Maga Engineering (Pvt) Ltd. All rights reserved. Automated Inter-Site Clearance Protocol.
        </p>
      </footer>
    </div>
  );
}
