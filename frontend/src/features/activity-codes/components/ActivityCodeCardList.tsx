/**
 * ActivityCodeCardList.tsx — Mobile card rendering for activity codes with Accordion Tree.
 */
import { useState, useMemo } from 'react';
import type { ActivityCode } from '../services/activityCodeService';
import {
  Split,
  Layers,
  CornerDownRight,
  Tag,
  FolderGit2,
  ChevronRight,
  Pencil,
} from 'lucide-react';

const isStandardCode = (code: string) => /^\d{2}-\d{2}-\d{2}-\d{2}/i.test((code || '').trim());

interface Props {
  data: ActivityCode[];
  onCardClick: (c: ActivityCode) => void;
  onDerive?: (parent: ActivityCode) => void;
}

export default function ActivityCodeCardList({ data, onCardClick, onDerive }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const masterMap = new Map<string, { master: ActivityCode; subActivities: ActivityCode[]; isStandalone: boolean }>();
    const codeToMasterId = new Map<string, string>();
    const subList: ActivityCode[] = [];

    for (const item of data) {
      if (!item.isDerived) {
        masterMap.set(item.id, {
          master: item,
          subActivities: [],
          isStandalone: !isStandardCode(item.code),
        });
        codeToMasterId.set(item.code.toUpperCase().trim(), item.id);
      } else {
        subList.push(item);
      }
    }

    for (const sub of subList) {
      let parentId = sub.parentActivityId;
      if (!parentId && sub.parentActivity?.code) {
        parentId = codeToMasterId.get(sub.parentActivity.code.toUpperCase().trim());
      }
      if (!parentId) {
        const match = sub.code.trim().match(/^(\d{2}-\d{2}-\d{2}-\d{2})/);
        if (match) parentId = codeToMasterId.get(match[1].toUpperCase());
      }

      if (parentId && masterMap.has(parentId)) {
        masterMap.get(parentId)!.subActivities.push(sub);
      } else {
        masterMap.set(sub.id, {
          master: sub,
          subActivities: [],
          isStandalone: false,
        });
      }
    }

    return Array.from(masterMap.values()).sort((a, b) => {
      if (a.isStandalone !== b.isStandalone) return a.isStandalone ? 1 : -1;
      return a.master.code.localeCompare(b.master.code);
    });
  }, [data]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="md:hidden flex flex-col gap-3">
      {groups.map(({ master, subActivities, isStandalone }) => {
        const isExpanded = expandedIds.has(master.id);
        const hasChildren = subActivities.length > 0;

        return (
          <div
            key={master.id}
            className={`w-full rounded-xl border ${
              isExpanded ? 'border-indigo-300 bg-indigo-50/15' : 'border-slate-200 bg-white'
            } p-3.5 flex flex-col gap-2.5 shadow-2xs transition-all`}
          >
            {/* Top Row: Code + Level Badge */}
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300">
                {master.code}
              </span>

              <div className="flex items-center gap-1.5">
                {isStandalone ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Tag size={9} />
                    <span>Standalone</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    <Layers size={9} />
                    <span>Master Code</span>
                  </span>
                )}
              </div>
            </div>

            {/* Description (Clickable to edit master) */}
            <div
              onClick={() => onCardClick(master)}
              className="text-xs font-semibold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
            >
              {master.description}
            </div>

            {/* Bottom Row: Unit + Actions (Sub task button & Expand badge) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 w-full text-xs">
              <span className="font-mono text-[11px] text-slate-500">
                Unit: {master.unit || '—'}
              </span>

              <div className="flex items-center gap-2">
                {!isStandalone && onDerive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDerive(master);
                    }}
                    className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
                  >
                    <Split size={10} className="text-blue-600" />
                    <span>Sub task</span>
                  </button>
                )}

                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(master.id);
                    }}
                    className={`inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      isExpanded
                        ? 'bg-indigo-600 text-white border border-indigo-700'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    <FolderGit2 size={10} className={isExpanded ? 'text-indigo-200' : 'text-indigo-500'} />
                    <span>{subActivities.length} Sub</span>
                    <ChevronRight size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Mobile Expanded Sub-activities list ── */}
            {isExpanded && hasChildren && (
              <div className="mt-1 pt-2 border-t border-indigo-100 flex flex-col gap-1.5 pl-2 border-l-2 border-indigo-400">
                <div className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider mb-0.5">
                  Derived Sub-Activities ({subActivities.length})
                </div>
                {subActivities.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => onCardClick(sub)}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CornerDownRight size={12} className="text-blue-500 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-mono text-[11px] font-bold text-blue-900">
                          {sub.code}
                        </span>
                        <span className="text-[11px] text-slate-800 font-medium">
                          {sub.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] text-slate-500">
                        {sub.unit || ''}
                      </span>
                      <Pencil size={11} className="text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
