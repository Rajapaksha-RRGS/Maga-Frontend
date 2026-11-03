/**
 * NeedsAttentionPanel.tsx
 *
 * Actionable list of items requiring the admin's immediate attention today.
 * - Unassigned active employees
 * - Supervisors who haven't submitted yet
 *
 * Fixed height container matching TodayActivityPanel (h-[480px]) with internal scroll.
 */
import { Link } from 'react-router-dom';
import { UserX, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AttentionItem {
  id: string;
  type: 'unassigned' | 'unsubmitted';
  label: string;
  detail: string;
  link: string;
}

interface Props {
  items: AttentionItem[];
}

export default function NeedsAttentionPanel({ items }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col h-[480px] transition-colors">
      <div className="flex items-center justify-between flex-shrink-0 mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-amber-500" />
            Needs Attention
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pending actions and alerts requiring supervisor or admin review
          </p>
        </div>
        {items.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {Math.min(items.length, 9)}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700">All clear!</p>
          <p className="text-xs text-slate-400 text-center max-w-xs">
            All employees are assigned and supervisors have submitted.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className="group flex items-start gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-200 transition-all flex-shrink-0"
            >
              <div className="mt-0.5 flex-shrink-0">
                {item.type === 'unassigned' ? (
                  <UserX size={15} className="text-amber-600" />
                ) : (
                  <AlertTriangle size={15} className="text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{item.label}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">{item.detail}</p>
              </div>
              <ArrowRight
                size={14}
                className="text-amber-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5"
              />
            </Link>
          ))}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-shrink-0 mt-auto">
        <span className="text-[11px] text-slate-400">
          {items.length} {items.length === 1 ? 'item requires action' : 'items require action'}
        </span>
        <Link
          to="/admin/approvals"
          className="text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline flex items-center gap-1 transition-colors"
        >
          <span>Review Approvals</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
