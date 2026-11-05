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
  AlertCircle,
  Loader2,
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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto space-y-4">
        {/* MAGA Corporate Banner Header */}
        <div className="bg-gradient-to-r from-[#002B49] to-[#001B30] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-extrabold tracking-wider text-white">MAGA</div>
              <div className="text-[11px] font-semibold text-[#E5A93C] tracking-wide uppercase mt-0.5">
                MAGA Engineering (Pvt) Ltd
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <ShieldCheck size={13} />
              <span>1-Click Authorization</span>
            </span>
          </div>
          <div className="h-px bg-white/15 my-3.5"></div>
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-amber-400" />
            <span>Inter-Site Personnel Transfer Clearance</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Releasing Project Manager Mobilization &amp; Effective Date Authorization
          </p>
        </div>

        {/* Loading Screen */}
        {isLoading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
            <Loader2 size={32} className="animate-spin text-blue-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Verifying authorization token…</p>
            <p className="text-xs text-slate-400 mt-1">Connecting to MAGA mobilization ledger</p>
          </div>
        )}

        {/* Error Screen */}
        {!isLoading && error && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-red-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-3">
              <XCircle size={28} />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Authorization Link Unavailable</h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto mb-4">{error}</p>
            <p className="text-[11px] text-slate-400 italic">
              Please contact Central HR or the requesting Project Manager to re-issue the transfer request.
            </p>
          </div>
        )}

        {/* Already Processed Screen */}
        {!isLoading && !error && isProcessed && !successMessage && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Transfer Already Processed</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{processedMessage}</p>
            </div>
            {transfer && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-700 space-y-1">
                <div>
                  <strong>Personnel:</strong> {transfer.corporateEmployee?.fullName} ({transfer.corporateEmployee?.employeeCode})
                </div>
                <div>
                  <strong>Current Status:</strong>{' '}
                  <span className="font-semibold uppercase text-blue-700">{transfer.status}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Screen after Confirmation */}
        {successMessage && (
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center shadow-sm border border-emerald-200 space-y-4 animate-in fade-in">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 size={34} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Personnel Mobilization Confirmed!</h2>
              <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 mt-2 text-left leading-relaxed">
                {successMessage}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              The employee has been automatically deactivated at your station and enrolled into the destination project roster. Both Project Managers have been notified via confirmation email.
            </p>
          </div>
        )}

        {/* Active Review & Approval Form */}
        {!isLoading && !error && !isProcessed && !successMessage && transfer && (
          <form onSubmit={handleApprove} className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            {/* Notice for Releasing PM */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed flex items-start gap-2">
              <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Notice for Releasing Project Manager:</strong> You are authorizing the mobilization of this employee to another site. You may adjust the <strong>Actual Effective Release Date</strong> below to match your site schedule.
              </div>
            </div>

            {/* Personnel Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} />
                <span>Personnel Information</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200">
                <div className="font-bold text-slate-900 text-sm">
                  {transfer.corporateEmployee?.fullName}
                </div>
                <span className="font-mono text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold">
                  {transfer.corporateEmployee?.employeeCode}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400">Designation / Trade:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {transfer.corporateEmployee?.tradeGroup?.name || 'General Labour'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">NIC:</span>{' '}
                  <span className="font-semibold text-slate-800">{transfer.corporateEmployee?.nicNo || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Transfer Station Route */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} />
                <span>Mobilization Station Route</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 text-[11px] block">Releasing Station (From):</span>
                  <span className="font-bold text-amber-800">
                    {transfer.fromProject?.projectName || transfer.fromProject?.projectCode}
                  </span>
                </div>
                <ArrowRightLeft size={16} className="text-slate-400 hidden sm:block" />
                <div>
                  <span className="text-slate-400 text-[11px] block">Destination Station (To):</span>
                  <span className="font-bold text-blue-700">
                    {transfer.toProject?.projectName || transfer.toProject?.projectCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Requested Mobilization Timeline Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-700" />
                  <span>Requested Mobilization Date</span>
                </span>
                <span className="font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
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
                <div className="text-[11px] text-amber-800 italic pt-1 border-t border-amber-200/60">
                  Scope / Justification: "{transfer.remarks}"
                </div>
              )}
            </div>

            {/* Releasing PM Input Section */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Actual Effective Release Date (ඔබට සැබවින්ම මුදාහළ හැකි දිනය) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={effectiveReleaseDate}
                    onChange={(e) => setEffectiveReleaseDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  * If ongoing site casting or works delay release, adjust this date. The worker will be auto-transferred starting on this date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Release / Handover Remarks (සටහන් / Gate Pass අංකය):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Released after slab casting. Gate pass #GP-891 issued."
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            {/* Action Buttons */}
            {!showDeclineForm ? (
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDeclineForm(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Decline Request
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !effectiveReleaseDate}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
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
              <div className="pt-3 border-t border-red-200 space-y-2.5 bg-red-50/60 p-3.5 rounded-xl border">
                <label className="block text-xs font-bold text-red-900">
                  Reason for Declining (ප්‍රතික්ෂේප කිරීමට හේතුව):
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Critical shuttering work in progress, worker cannot be released this month."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-red-300 focus:outline-hidden focus:ring-2 focus:ring-red-600 bg-white"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowDeclineForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-white cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !declineReason.trim()}
                    onClick={handleDecline}
                    className="px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting…' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Official Footer */}
      <footer className="text-center text-[11px] text-slate-500 mt-8 space-y-1">
        <p className="font-semibold text-slate-700">MAGA ENGINEERING (PVT) LTD &bull; Plant &amp; Labor Mobilization</p>
        <p>Head Office: 200 Nawala Road, Narahenpita, Colombo 05, Sri Lanka | Web: www.maga.lk</p>
      </footer>
    </div>
  );
}

