/**
 * ActivityCodeCardList.tsx — Mobile card rendering for activity codes.
 */
import CardList from '../../../components/CardList';
import type { ActivityCode } from '../services/activityCodeService';
import { Split, Layers, CornerDownRight } from 'lucide-react';

interface Props {
  data: ActivityCode[];
  onCardClick: (c: ActivityCode) => void;
  onDerive?: (parent: ActivityCode) => void;
}

export default function ActivityCodeCardList({ data, onCardClick, onDerive }: Props) {
  return (
    <CardList
      data={data}
      keyField="id"
      renderCard={(item) => (
        <button
          onClick={() => onCardClick(item)}
          className={`w-full text-left rounded-xl border ${
            item.isDerived ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200 bg-white'
          } p-3.5 flex flex-col gap-2 transition-all hover:border-blue-300 hover:shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5">
              {item.isDerived ? (
                <>
                  <CornerDownRight size={14} className="text-blue-500 shrink-0" />
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    {item.code}
                  </span>
                </>
              ) : (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
                  {item.code}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item.isDerived ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  <Split size={9} />
                  <span>Site Sub</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  <Layers size={9} />
                  <span>Master</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <span className={`text-xs ${item.isDerived ? 'text-slate-800 font-medium' : 'text-slate-900 font-semibold'} line-clamp-2`}>
              {item.description}
            </span>
            {item.isDerived && item.parentActivity && (
              <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                <span>↳ Parent:</span>
                <span className="font-mono font-medium text-slate-700">{item.parentActivity.code}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 w-full mt-1">
            <span className="font-mono text-[11px] text-slate-500">
              Unit: {item.unit || '—'}
            </span>

            {!item.isDerived && onDerive && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDerive(item);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer"
              >
                <Split size={10} />
                <span>+ Derive</span>
              </span>
            )}
          </div>
        </button>
      )}
    />
  );
}
