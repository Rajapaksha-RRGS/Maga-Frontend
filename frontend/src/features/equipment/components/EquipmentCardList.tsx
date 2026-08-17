/**
 * EquipmentCardList.tsx — Mobile card rendering for equipment.
 */
import CardList from '../../../components/CardList';
import StatusBadge from '../../../components/StatusBadge';
import type { Equipment } from '../services/equipmentService';

interface Props { data: Equipment[]; onCardClick: (e: Equipment) => void; }

export default function EquipmentCardList({ data, onCardClick }: Props) {
  return (
    <CardList data={data} keyField="id" renderCard={(item) => (
      <button
        onClick={() => onCardClick(item)}
        className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center justify-between transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{item.name}</p>
          <p className="text-xs text-slate-500">{item.type}</p>
        </div>
        <StatusBadge status={item.status} />
      </button>
    )} />
  );
}
