/**
 * BusinessPartnerCardList.tsx
 *
 * Mobile card list view for Business Partners (visible below md breakpoint).
 */
import type { BusinessPartner } from '../services/businessPartnerService';
import { Building2, Phone, ChevronRight } from 'lucide-react';

interface Props {
  data: BusinessPartner[];
  onCardClick: (partner: BusinessPartner) => void;
}

export default function BusinessPartnerCardList({ data, onCardClick }: Props) {
  return (
    <div className="md:hidden flex flex-col gap-2.5">
      {data.map((bp) => (
        <div
          key={bp.id}
          onClick={() => onCardClick(bp)}
          className="bg-white rounded-lg border border-slate-200 p-3.5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Building2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {bp.code}
                </span>
                <span className="font-medium text-slate-800 text-sm truncate">
                  {bp.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                {bp.contactPerson && (
                  <span className="truncate">{bp.contactPerson}</span>
                )}
                {bp.phone && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Phone size={10} />
                    {bp.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={[
                'w-2 h-2 rounded-full',
                bp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400',
              ].join(' ')}
            />
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        </div>
      ))}
    </div>
  );
}
