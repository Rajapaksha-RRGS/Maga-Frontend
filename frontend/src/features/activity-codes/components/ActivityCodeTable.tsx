/**
 * ActivityCodeTable.tsx — Desktop table for activity codes with Accordion Tree view.
 *
 * Implements Option 1: Expandable Accordion Tree
 * - Master BOQ codes (00-00-00-00) & Standalone special codes (ZOTHE, ZIDEL) are primary rows.
 * - Derived sub-activities (-M, -E, /01) are grouped directly inside their parent Master code.
 * - 1-Click expandable chevron [▶ / ▼] reveals/hides nested sub-tasks in an indented sub-panel.
 * - Consistent row heights and zero UI clutter.
 */
import { useState, useMemo, useEffect, Fragment } from 'react';
import type { ActivityCode } from '../services/activityCodeService';
import {
  Split,
  Layers,
  CornerDownRight,
  Tag,
  FolderGit2,
  ChevronRight,
  Pencil,
  ChevronsUpDown,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';

const isStandardCode = (code: string) => /^\d{2}-\d{2}-\d{2}-\d{2}/i.test((code || '').trim());

export interface ActivityGroupNode {
  master: ActivityCode;
  subActivities: ActivityCode[];
  isStandalone: boolean;
}

interface Props {
  data: ActivityCode[];
  onRowClick: (c: ActivityCode) => void;
  onDerive?: (parent: ActivityCode) => void;
  search?: string;
}

export default function ActivityCodeTable({ data, onRowClick, onDerive, search = '' }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ── Group Flat Activity List into Master -> Children Tree ──────────────────
  const { groups, totalSubActivitiesCount } = useMemo(() => {
    const masterMap = new Map<string, ActivityGroupNode>();
    const codeToMasterId = new Map<string, string>();
    const subList: ActivityCode[] = [];
    let subTotal = 0;

    // Pass 1: Identify all Root Masters and Standalone Codes
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

    // Pass 2: Map Derived Sub-Activities to their Parent Master
    for (const sub of subList) {
      subTotal++;
      let parentId = sub.parentActivityId;

      // Try resolving by parent code if ID not directly mapped
      if (!parentId && sub.parentActivity?.code) {
        parentId = codeToMasterId.get(sub.parentActivity.code.toUpperCase().trim());
      }

      // Try resolving by base code prefix (e.g. 00-00-20-20 from 00-00-20-20-M)
      if (!parentId) {
        const match = sub.code.trim().match(/^(\d{2}-\d{2}-\d{2}-\d{2})/);
        if (match) {
          parentId = codeToMasterId.get(match[1].toUpperCase());
        }
      }

      if (parentId && masterMap.has(parentId)) {
        masterMap.get(parentId)!.subActivities.push(sub);
      } else {
        // Fallback: If orphan derived activity whose master is absent, show as its own root entry
        masterMap.set(sub.id, {
          master: sub,
          subActivities: [],
          isStandalone: false,
        });
      }
    }

    // Sort sub-activities by code within each master
    for (const group of masterMap.values()) {
      group.subActivities.sort((a, b) => a.code.localeCompare(b.code));
    }

    // Sort master rows: standard codes first, then standalone
    const sortedGroups = Array.from(masterMap.values()).sort((a, b) => {
      if (a.isStandalone !== b.isStandalone) {
        return a.isStandalone ? 1 : -1;
      }
      return a.master.code.localeCompare(b.master.code);
    });

    return { groups: sortedGroups, totalSubActivitiesCount: subTotal };
  }, [data]);

  // ── Auto-expand parents if search matches a child sub-activity ─────────────
  useEffect(() => {
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const autoExpand = new Set<string>();
      for (const group of groups) {
        const hasMatchingChild = group.subActivities.some(
          (sub) => sub.code.toLowerCase().includes(q) || sub.description?.toLowerCase().includes(q)
        );
        if (hasMatchingChild) {
          autoExpand.add(group.master.id);
        }
      }
      if (autoExpand.size > 0) {
        setExpandedIds((prev) => new Set([...prev, ...autoExpand]));
      }
    }
  }, [search, groups]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allParentIds = groups
      .filter((g) => g.subActivities.length > 0)
      .map((g) => g.master.id);
    setExpandedIds(new Set(allParentIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const allExpandableCount = groups.filter((g) => g.subActivities.length > 0).length;
  const isAllExpanded = allExpandableCount > 0 && groups.filter((g) => g.subActivities.length > 0).every((g) => expandedIds.has(g.master.id));

  return (
    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
      {/* ── Top Tree Toolbar ────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">
            {groups.length} Work Package{groups.length !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-mono">
            {totalSubActivitiesCount} Derived Sub-activit{totalSubActivitiesCount !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {allExpandableCount > 0 && (
          <button
            type="button"
            onClick={isAllExpanded ? collapseAll : expandAll}
            className="flex items-center gap-1.5 font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50/50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title={isAllExpanded ? 'Collapse all sub-activities' : 'Expand all sub-activities'}
          >
            {isAllExpanded ? (
              <>
                <ChevronsUp size={14} className="text-indigo-600" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronsDown size={14} className="text-indigo-600" />
                <span>Expand All ({allExpandableCount})</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Table with Accordion Rows ─────────────────────────────────── */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)] min-h-[360px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <tr className="text-slate-600 font-semibold uppercase tracking-wide text-[11px]">
              <th className="w-10 px-2 py-3 text-center" title="Expand / Collapse">
                <ChevronsUpDown size={13} className="mx-auto text-slate-400" />
              </th>
              <th className="px-4 py-3 w-[180px] whitespace-nowrap">Activity Code</th>
              <th className="px-4 py-3 min-w-[260px]">Description</th>
              <th className="px-4 py-3 w-[150px] whitespace-nowrap">Level / Type</th>
              <th className="px-4 py-3 w-[90px] whitespace-nowrap">Unit</th>
              <th className="px-4 py-3 w-[240px] min-w-[240px] whitespace-nowrap text-right pr-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map(({ master, subActivities, isStandalone }) => {
              const hasChildren = subActivities.length > 0;
              const isExpanded = expandedIds.has(master.id);

              return (
                <Fragment key={master.id}>
                  {/* ── Main Master / Standalone Row ── */}
                  <tr
                    onClick={() => onRowClick(master)}
                    className={`transition-colors cursor-pointer select-none ${
                      isExpanded
                        ? 'bg-indigo-50/30 hover:bg-indigo-50/50'
                        : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Expand Chevron Column */}
                    <td
                      className="w-10 px-2 py-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) toggleExpand(master.id);
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-700 hover:bg-indigo-100/70 transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse sub-activities' : `Expand ${subActivities.length} sub-activity(ies)`}
                        >
                          <ChevronRight
                            size={15}
                            className={`transition-transform duration-200 ${
                              isExpanded ? 'rotate-90 text-indigo-700' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-200 mx-auto" />
                      )}
                    </td>

                    {/* Activity Code */}
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                      {isStandalone ? (
                        <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded shadow-2xs">
                          {master.code}
                        </span>
                      ) : (
                        <span className="bg-slate-100 border border-slate-300 text-slate-900 px-2 py-0.5 rounded shadow-2xs">
                          {master.code}
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 text-xs">
                        {master.description}
                      </div>
                    </td>

                    {/* Level / Type Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isStandalone ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full"
                          title="Standalone Overhead/Idle Activity (Non-divisible)"
                        >
                          <Tag size={11} className="shrink-0" />
                          <span>Standalone</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                          <Layers size={11} className="shrink-0" />
                          <span>Master Code</span>
                        </span>
                      )}
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {master.unit || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right pr-6">
                      <div
                        className="inline-flex items-center gap-2 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Derive Button */}
                        {!isStandalone && onDerive && (
                          <button
                            type="button"
                            onClick={() => onDerive(master)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                            title={`Derive site-specific sub-activity from ${master.code}`}
                          >
                            <Split size={12} className="text-blue-600 shrink-0" />
                            <span>Sub task</span>
                          </button>
                        )}

                        {/* Expandable Sub-tasks Counter Pill */}
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(master.id)}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
                              isExpanded
                                ? 'bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                            }`}
                            title={isExpanded ? 'Click to collapse' : 'Click to view sub-activities'}
                          >
                            <FolderGit2 size={12} className={isExpanded ? 'text-indigo-200 shrink-0' : 'text-indigo-500 shrink-0'} />
                            <span>
                              {subActivities.length} Sub task{subActivities.length > 1 ? 's' : ''}
                            </span>
                            <ChevronRight
                              size={12}
                              className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── Expandable Nested Sub-Activities Panel ── */}
                  {isExpanded && hasChildren && (
                    <tr className="bg-slate-50/70 border-b border-indigo-100">
                      <td colSpan={6} className="p-0">
                        <div className="py-3 px-6 pl-12 bg-gradient-to-r from-indigo-50/50 via-slate-50/30 to-transparent border-l-4 border-indigo-500 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1.5 text-indigo-900 font-bold">
                              <FolderGit2 size={13} className="text-indigo-600" />
                              <span>
                                Derived Sub-Activities under {master.code} ({subActivities.length})
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              Rolls up to Master BOQ: {master.code} ({master.description})
                            </span>
                          </div>

                          <div className="rounded-lg border border-indigo-100 bg-white overflow-hidden shadow-2xs divide-y divide-slate-100">
                            {subActivities.map((sub) => (
                              <div
                                key={sub.id}
                                onClick={() => onRowClick(sub)}
                                className="flex items-center justify-between px-3.5 py-2.5 hover:bg-indigo-50/30 transition-colors cursor-pointer group text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <CornerDownRight size={14} className="text-blue-500 shrink-0" />
                                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shrink-0 shadow-2xs">
                                    {sub.code}
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {sub.description}
                                  </span>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                  <span className="font-mono text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                    {sub.unit ? `Unit: ${sub.unit}` : '—'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                    <Split size={10} />
                                    <span>Site Sub-Activity</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRowClick(sub);
                                    }}
                                    className="p-1.5 rounded text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    title="Edit Sub-Activity"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
