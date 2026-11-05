import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
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
      setError('Invalid or missing link. Please open the link directly from your email.');
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${apiUrl}/corporate/transfers/verify-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'This transfer link has expired or is invalid.');
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
        setError(err.message || 'Unable to connect to the server. Please check your internet connection.');
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
        `${transfer?.corporateEmployee?.fullName || 'Employee'} has been released to ${transfer?.toProject?.projectName || 'destination project'}.`
      );
    } catch (err: any) {
      alert(err.message || 'Error processing transfer.');
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

      setProcessedMessage('Transfer request has been declined.');
      setIsProcessed(true);
    } catch (err: any) {
      alert(err.message || 'Error declining transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 font-sans">
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Simple Brand Header */}
        <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight text-[#002B49]">MAGA</div>
            <div className="text-xs text-slate-500 font-medium">Site Mobilization</div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Pending Release
          </span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
            <Loader2 size={32} className="animate-spin text-[#002B49] mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">Loading transfer details…</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="bg-white rounded-2xl p-6 text-center border border-red-200 shadow-xs space-y-3">
            <XCircle size={36} className="text-red-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">Link Expired or Invalid</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}

        {/* Already Processed */}
        {!isLoading && !error && isProcessed && !successMessage && (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-xs space-y-3">
            <CheckCircle2 size={36} className="text-blue-700 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">Request Already Handled</h2>
            <p className="text-sm text-slate-600">{processedMessage}</p>
            {transfer && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 text-left space-y-1">
                <div><strong>Employee:</strong> {transfer.corporateEmployee?.fullName} ({transfer.corporateEmployee?.employeeCode})</div>
                <div><strong>Status:</strong> <span className="font-semibold uppercase text-blue-700">{transfer.status}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Success Confirmed */}
        {successMessage && (
          <div className="bg-white rounded-2xl p-6 text-center border border-emerald-200 shadow-xs space-y-3 animate-in fade-in">
            <CheckCircle2 size={44} className="text-emerald-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Transfer Approved!</h2>
            <p className="text-sm text-slate-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              {successMessage}
            </p>
            <p className="text-xs text-slate-500">
              The employee record has been transferred. Both project managers have been notified.
            </p>
          </div>
        )}

        {/* Main Review Form */}
        {!isLoading && !error && !isProcessed && !successMessage && transfer && (
          <form onSubmit={handleApprove} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            {/* Title */}
            <div>
              <h1 className="text-lg font-bold text-slate-900">Employee Release Request</h1>
              <p className="text-xs text-slate-500 mt-0.5">Please review and confirm the release date below.</p>
            </div>

            {/* Employee Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="text-base font-bold text-slate-900">
                {transfer.corporateEmployee?.fullName}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-mono font-semibold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-800">
                  {transfer.corporateEmployee?.employeeCode}
                </span>
                <span className="font-medium text-slate-600">
                  {transfer.corporateEmployee?.tradeGroup?.name || 'General Labour'}
                </span>
                {transfer.corporateEmployee?.nicNo && (
                  <span className="text-slate-400">
                    &bull; NIC: {transfer.corporateEmployee.nicNo}
                  </span>
                )}
              </div>
            </div>

            {/* Route */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span>Transfer Route</span>
                <Building2 size={14} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex-1 font-semibold text-slate-700">
                  {transfer.fromProject?.projectName || transfer.fromProject?.projectCode}
                </div>
                <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 font-bold text-blue-700 text-right">
                  {transfer.toProject?.projectName || transfer.toProject?.projectCode}
                </div>
              </div>
            </div>

            {/* Requested Date & Note */}
            <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900">Requested For:</span>
                <span className="font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {transfer.startDate
                    ? new Date(transfer.startDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Immediate'}
                </span>
              </div>
              {transfer.remarks && (
                <div className="text-amber-800 pt-1 border-t border-amber-200/70 italic">
                  "{transfer.remarks}"
                </div>
              )}
            </div>

            {/* Actual Release Date Input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-sm font-semibold text-slate-800">
                Effective Release Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={effectiveReleaseDate}
                  onChange={(e) => setEffectiveReleaseDate(e.target.value)}
                  className="w-full text-base px-3.5 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002B49] bg-white text-slate-900 font-medium cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Change the date if site work delays releasing this employee.
              </p>
            </div>

            {/* Remarks Input */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Handover / Gate Pass Notes <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Gate pass #GP-401 issued"
                value={releaseRemarks}
                onChange={(e) => setReleaseRemarks(e.target.value)}
                className="w-full text-base px-3.5 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#002B49] bg-white text-slate-900"
              />
            </div>

            {/* Action Buttons */}
            {!showDeclineForm ? (
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !effectiveReleaseDate}
                  className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#002B49] hover:bg-[#001D33] active:bg-[#001424] text-white text-base font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <span>Approve &amp; Release</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDeclineForm(true)}
                  className="w-full min-h-[44px] text-sm font-medium text-slate-600 hover:text-red-700 hover:bg-red-50/50 rounded-xl transition-colors cursor-pointer"
                >
                  Decline Request
                </button>
              </div>
            ) : (
              /* Decline Form */
              <div className="pt-2 space-y-2.5 bg-red-50/70 p-4 rounded-xl border border-red-200">
                <label className="block text-xs font-bold text-red-900">
                  Reason for Declining:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Worker needed for critical slab casting"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-red-300 focus:outline-hidden focus:ring-2 focus:ring-red-600 bg-white text-slate-900"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowDeclineForm(false)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-white cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || !declineReason.trim()}
                    onClick={handleDecline}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting…' : 'Confirm Decline'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 mt-8">
        MAGA Engineering (Pvt) Ltd &bull; Labor Mobilization System
      </footer>
    </div>
  );
}
