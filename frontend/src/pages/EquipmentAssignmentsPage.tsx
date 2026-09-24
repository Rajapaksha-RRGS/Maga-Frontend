/**
 * EquipmentAssignmentsPage.tsx — Admin equipment-to-supervisor assignment page.
 *
 * Two-panel ERP layout: unassigned equipment (left) + supervisors with assigned equipment (right).
 * Follows the same pattern as labour assign but for equipment items.
 */
import { useState } from 'react';
import { AlertTriangle, Search, UserPlus, Truck, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[dt.getUTCDay()];
}

export default function EquipmentAssignmentsPage() {
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [search, setSearch] = useState('');

  // Placeholder data — will be replaced by real API integration
  const isLoading = false;
  const isToday = selectedDate === getTodayStr();

  return (
    <div className="px-4 md:px-6 py-5">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Truck size={16} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-base font-medium text-slate-800">Equipment assign</h1>
            <p className="text-xs text-slate-400 mt-0.5">Assign equipment to supervisors for daily operations</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Date Selector with Previous / Next Day controls */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-xl border border-slate-100">
            <Calendar size={16} className="text-amber-600 flex-shrink-0" />
            <input
              id="eq-assign-date"
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer font-mono"
            />
            <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md hidden sm:inline-block">
              {getDayName(selectedDate)}
            </span>
            {isToday && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Jump to Today"
            >
              Today
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="eq-assign-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-slate-400 py-8 text-center">Loading equipment assignments…</p>
      )}

      {/* Two-panel layout */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left panel — Unassigned equipment */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-slate-400" />
                <h2 className="text-sm font-medium text-slate-700">Unassigned equipment</h2>
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">0 items</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                  <Truck size={20} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 mb-1">No unassigned equipment</p>
                <p className="text-xs text-slate-300">All equipment has been assigned for {selectedDate}</p>
              </div>
            </div>
          </div>

          {/* Right panel — Supervisor gangs */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-slate-400" />
                <h2 className="text-sm font-medium text-slate-700">Supervisors</h2>
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">0 supervisors</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                  <UserPlus size={20} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 mb-1">No supervisors loaded</p>
                <p className="text-xs text-slate-300">Connect to API to load supervisor list</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-5">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          Equipment assignments will be linked to the backend API. Use the same date-based workflow as labour assign.
        </p>
      </div>
    </div>
  );
}
