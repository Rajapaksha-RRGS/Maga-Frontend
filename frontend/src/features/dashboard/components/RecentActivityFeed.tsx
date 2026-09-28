/**
 * RecentActivityFeed.tsx
 *
 * Full-width wide activity feed of supervisor daily submissions.
 * Designed with modern responsive cards in soft pastel colors matching executive dashboard styling.
 */
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BackendTimeEntry } from '../../time-entries/services/timeEntryService';

interface Props {
  entries: BackendTimeEntry[];
  isLoading: boolean;
}

function formatTime(isoOrTime: string | null): string {
  if (!isoOrTime) return '—';
  try {
    if (isoOrTime.includes('T')) {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(isoOrTime));
    }
    return isoOrTime.substring(0, 5);
  } catch {
    return '—';
  }
}

function getInitials(name: string): string {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ── Soft Pastel Avatars ──
const AVATAR_COLORS = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/80' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/80' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200/80' },
];

export default function RecentActivityFeed({ entries, isLoading }: Props) {
  // Group submitted entries by supervisor
  const submittedEntries = entries.filter((e) => e.status === 'submitted' && e.supervisor);

  // Build a map: supervisorId → { name, count, latestTime }
  const supMap = new Map<string, { name: string; count: number; latestTime: string | null }>();
  for (const e of submittedEntries) {
    const sid = e.supervisorId;
    const name = e.supervisor?.fullName ?? 'Unknown';
    const existing = supMap.get(sid);
    if (!existing) {
      supMap.set(sid, { name, count: 1, latestTime: e.submittedAt });
    } else {
      existing.count += 1;
      if (e.submittedAt && (!existing.latestTime || e.submittedAt > existing.latestTime)) {
        existing.latestTime = e.submittedAt;
      }
    }
  }

  const feedItems = Array.from(supMap.entries())
    .sort((a, b) => {
      const ta = a[1].latestTime ?? '';
      const tb = b[1].latestTime ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, 6);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
      {/* ── Wide Header with Pill Action ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold text-slate-800">
            Recent activity
          </h2>
          {feedItems.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {feedItems.length} submissions today
            </span>
          )}
        </div>

        <Link
          to="/admin/approvals"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs group"
        >
          <span>View all</span>
          <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : feedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Clock size={18} className="text-slate-400" />
          </div>
          <p className="text-xs font-medium text-slate-600">
            No submissions recorded yet today
          </p>
          <p className="text-[11px] text-slate-400">
            Supervisor daily sheet submissions will appear here in real time.
          </p>
        </div>
      ) : (
        /* Wide Grid of Activity Cards (Matching the reference screenshot style) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {feedItems.map(([supId, { name, count, latestTime }], idx) => {
            const avatar = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initials = getInitials(name);

            return (
              <Link
                key={supId}
                to="/admin/approvals"
                className="group p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-all shadow-2xs hover:shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Left Avatar Circle (Pastel colored badge with initials) */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 border ${avatar.bg} ${avatar.text} ${avatar.border}`}>
                    {initials}
                  </div>

                  {/* Supervisor details */}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                      {name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
                      <span>{count} {count === 1 ? 'entry' : 'entries'}</span>
                      <span>·</span>
                      <span className="font-mono">{formatTime(latestTime)}</span>
                    </p>
                  </div>
                </div>

                {/* Right Done Badge + Arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    Done
                  </span>
                  <ArrowRight
                    size={14}
                    className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
