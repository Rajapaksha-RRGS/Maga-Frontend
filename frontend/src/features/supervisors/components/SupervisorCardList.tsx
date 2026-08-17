/**
 * SupervisorCardList.tsx — Mobile card rendering for supervisor list.
 */
import CardList from '../../../components/CardList';
import StatusBadge from '../../../components/StatusBadge';
import { KeyRound, UserX } from 'lucide-react';
import type { Supervisor } from '../services/supervisorService';

interface Props {
  data: Supervisor[];
  onCardClick: (s: Supervisor) => void;
  onResetPassword: (id: string) => void;
  onDeactivate: (id: string) => void;
}

export default function SupervisorCardList({ data, onCardClick, onResetPassword, onDeactivate }: Props) {
  return (
    <CardList data={data} keyField="id" renderCard={(sup) => (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => onCardClick(sup)}
          className="w-full text-left flex items-center gap-3 mb-2"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-slate-600">{sup.fullName.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{sup.fullName}</p>
            <p className="text-xs text-slate-500 truncate font-mono">{sup.username}</p>
          </div>
          <StatusBadge status={sup.status} />
        </button>
        <div className="flex items-center gap-2 pl-12">
          {sup.linkedEmployeeName && (
            <span className="text-xs text-slate-400">Linked: {sup.linkedEmployeeName}</span>
          )}
          <div className="ml-auto flex gap-1">
            <button onClick={() => onResetPassword(sup.id)} title="Reset password" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
              <KeyRound size={14} />
            </button>
            {sup.status === 'active' && (
              <button onClick={() => onDeactivate(sup.id)} title="Deactivate" className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
                <UserX size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    )} />
  );
}
