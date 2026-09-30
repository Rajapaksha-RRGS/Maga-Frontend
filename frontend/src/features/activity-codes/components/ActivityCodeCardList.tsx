/**
 * ActivityCodeCardList.tsx — Mobile card rendering for activity codes.
 */
import CardList from '../../../components/CardList';
import type { ActivityCode } from '../services/activityCodeService';

interface Props { data: ActivityCode[]; onCardClick: (c: ActivityCode) => void; }

export default function ActivityCodeCardList({ data, onCardClick }: Props) {
  return (
    <CardList data={data} keyField="id" renderCard={(item) => (
      <button
        onClick={() => onCardClick(item)}
        className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-slate-800">{item.code}</span>
            {item.projectCode && (
              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {item.projectCode}
              </span>
            )}
          </div>
          <span className="text-sm text-slate-500 line-clamp-1">{item.description}</span>
        </div>
      </button>
    )} />
  );
}
