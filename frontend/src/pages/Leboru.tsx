import { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  Briefcase, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Send, 
  UserCheck,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export interface ActivityAllocation {
  id: string;
  activityCode: string;
  hours: number;
}

export interface Laborer {
  id: string;
  name: string;
  inTime: string;
  outTime: string;
  shiftHours: number;
  activities: ActivityAllocation[];
}

const ACTIVITIES = [
  { code: "ACT-101", label: "ACT-101 (Concrete Pouring)" },
  { code: "ACT-102", label: "ACT-102 (Reinforcement / Bar-bending)" },
  { code: "ACT-103", label: "ACT-103 (Bricklaying & Masonry)" },
  { code: "ACT-104", label: "ACT-104 (Excavation & Earthwork)" },
  { code: "ACT-105", label: "ACT-105 (Plastering & Finishing)" },
  { code: "ACT-106", label: "ACT-106 (Formwork & Scaffolding)" },
];

const INITIAL_LABORERS: Laborer[] = [
  { 
    id: "L001", 
    name: "Kamal Perera", 
    inTime: "08:00", 
    outTime: "17:00", 
    shiftHours: 8, 
    activities: [
      { id: "a-101", activityCode: "ACT-101", hours: 8 }
    ] 
  },
  { 
    id: "L002", 
    name: "Nimal Silva", 
    inTime: "08:00", 
    outTime: "17:00", 
    shiftHours: 8, 
    activities: [
      { id: "a-201", activityCode: "ACT-101", hours: 5 },
      { id: "a-202", activityCode: "ACT-102", hours: 3 }
    ] 
  },
  { 
    id: "L003", 
    name: "Sunil Shantha", 
    inTime: "08:00", 
    outTime: "17:00", 
    shiftHours: 8, 
    activities: [
      { id: "a-301", activityCode: "ACT-103", hours: 8 }
    ] 
  },
  { 
    id: "L004", 
    name: "Ruwan Kumara", 
    inTime: "", 
    outTime: "", 
    shiftHours: 0, 
    activities: [
      { id: "a-401", activityCode: "", hours: 0 }
    ] 
  },
  { 
    id: "L005", 
    name: "Ajith Bandara", 
    inTime: "", 
    outTime: "", 
    shiftHours: 0, 
    activities: [
      { id: "a-501", activityCode: "", hours: 0 }
    ] 
  },
];

// Time difference calculation helper (Decimal hours with 1hr lunch deduction if >= 5h)
const calculateHours = (inTime: string, outTime: string): number => {
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  
  let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes >= 300) totalMinutes -= 60; // 1-hour lunch
  
  return totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(1)) : 0;
};

export default function MobileLaborTracker() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [laborers, setLaborers] = useState<Laborer[]>(INITIAL_LABORERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Apply Input States
  const [bulkIn, setBulkIn] = useState("08:00");
  const [bulkOut, setBulkOut] = useState("17:00");
  const [bulkActivities, setBulkActivities] = useState<ActivityAllocation[]>([
    { id: "bulk-1", activityCode: "ACT-101", hours: 8 },
  ]);

  // Bulk hours total
  const bulkShiftHours = useMemo(() => calculateHours(bulkIn, bulkOut), [bulkIn, bulkOut]);
  const bulkAllocatedHours = useMemo(
    () => bulkActivities.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0),
    [bulkActivities]
  );

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === laborers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(laborers.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Activity Management
  const addBulkActivity = () => {
    const remaining = Math.max(0, parseFloat((bulkShiftHours - bulkAllocatedHours).toFixed(1)));
    const unusedActivity = ACTIVITIES.find(
      (a) => !bulkActivities.some((ba) => ba.activityCode === a.code)
    )?.code || ACTIVITIES[0].code;

    setBulkActivities((prev) => [
      ...prev,
      {
        id: `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        activityCode: unusedActivity,
        hours: remaining > 0 ? remaining : 0,
      },
    ]);
  };

  const updateBulkActivity = (id: string, field: "activityCode" | "hours", value: any) => {
    setBulkActivities((prev) =>
      prev.map((ba) => (ba.id === id ? { ...ba, [field]: value } : ba))
    );
  };

  const removeBulkActivity = (id: string) => {
    if (bulkActivities.length <= 1) return;
    setBulkActivities((prev) => prev.filter((ba) => ba.id !== id));
  };

  // Apply Quick Preset to Bulk Panel
  const applyPreset = (inT: string, outT: string, totalH: number) => {
    setBulkIn(inT);
    setBulkOut(outT);
    if (bulkActivities.length === 1) {
      setBulkActivities([{ ...bulkActivities[0], hours: totalH }]);
    }
  };

  // Bulk Apply Action
  const applyBulk = () => {
    if (selectedIds.length === 0) return;
    const computedShiftHours = calculateHours(bulkIn, bulkOut);

    setLaborers((prev) =>
      prev.map((l) => {
        if (!selectedIds.includes(l.id)) return l;

        // Clone bulk activities with new unique IDs for each worker
        const clonedActivities: ActivityAllocation[] = bulkActivities.map((ba, idx) => ({
          id: `${l.id}-act-${Date.now()}-${idx}`,
          activityCode: ba.activityCode,
          hours: Number(ba.hours) || 0,
        }));

        return {
          ...l,
          inTime: bulkIn,
          outTime: bulkOut,
          shiftHours: computedShiftHours,
          activities: clonedActivities,
        };
      })
    );
  };

  // Single Worker: Update In/Out Time
  const updateWorkerTimes = (id: string, field: "inTime" | "outTime", val: string) => {
    setLaborers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const inT = field === "inTime" ? val : l.inTime;
        const outT = field === "outTime" ? val : l.outTime;
        const newShiftHours = calculateHours(inT, outT);

        // If worker has only 1 activity and hours was equal to previous shift hours or 0, auto-sync
        let updatedActivities = l.activities;
        if (l.activities.length === 1 && (l.activities[0].hours === l.shiftHours || l.activities[0].hours === 0)) {
          updatedActivities = [{ ...l.activities[0], hours: newShiftHours }];
        }

        return {
          ...l,
          inTime: inT,
          outTime: outT,
          shiftHours: newShiftHours,
          activities: updatedActivities,
        };
      })
    );
  };

  // Single Worker: Add Activity Code
  const addWorkerActivity = (workerId: string) => {
    setLaborers((prev) =>
      prev.map((l) => {
        if (l.id !== workerId) return l;
        const currentAllocated = l.activities.reduce((acc, a) => acc + (Number(a.hours) || 0), 0);
        const remaining = Math.max(0, parseFloat((l.shiftHours - currentAllocated).toFixed(1)));
        
        const unusedActivity = ACTIVITIES.find(
          (a) => !l.activities.some((la) => la.activityCode === a.code)
        )?.code || ACTIVITIES[0].code;

        const newAllocation: ActivityAllocation = {
          id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          activityCode: unusedActivity,
          hours: remaining > 0 ? remaining : 0,
        };

        return {
          ...l,
          activities: [...l.activities, newAllocation],
        };
      })
    );
  };

  // Single Worker: Update an Activity row
  const updateWorkerActivity = (
    workerId: string,
    allocId: string,
    field: "activityCode" | "hours",
    val: any
  ) => {
    setLaborers((prev) =>
      prev.map((l) => {
        if (l.id !== workerId) return l;
        const updatedActivities = l.activities.map((a) =>
          a.id === allocId ? { ...a, [field]: val } : a
        );
        return {
          ...l,
          activities: updatedActivities,
        };
      })
    );
  };

  // Single Worker: Remove an Activity row
  const removeWorkerActivity = (workerId: string, allocId: string) => {
    setLaborers((prev) =>
      prev.map((l) => {
        if (l.id !== workerId) return l;
        if (l.activities.length <= 1) return l; // Keep at least one
        return {
          ...l,
          activities: l.activities.filter((a) => a.id !== allocId),
        };
      })
    );
  };

  // Global Hours Totals
  const totalAllocatedHours = useMemo(() => {
    return laborers.reduce(
      (total, l) =>
        total + l.activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0),
      0
    );
  }, [laborers]);

  const totalShiftHours = useMemo(() => {
    return laborers.reduce((acc, curr) => acc + (Number(curr.shiftHours) || 0), 0);
  }, [laborers]);

  // Activity breakdown summary
  const activityHoursSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    laborers.forEach((l) => {
      l.activities.forEach((a) => {
        if (a.activityCode && a.hours > 0) {
          summary[a.activityCode] = (summary[a.activityCode] || 0) + Number(a.hours);
        }
      });
    });
    return summary;
  }, [laborers]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-100 pb-32 flex flex-col text-slate-900 font-sans">
      {/* 1. Sticky Header with Date & Summary */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Daily Labor & Activity Log
          </h1>
          <div className="flex items-center gap-1">
            <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
              {totalAllocatedHours.toFixed(1)} / {totalShiftHours.toFixed(1)} hrs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-700"
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
          >
            {selectedIds.length === laborers.length ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
            Select All ({selectedIds.length})
          </button>
        </div>

        {/* Activity Hours Distribution Quick Badges */}
        {Object.keys(activityHoursSummary).length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
            <span className="text-slate-400 font-bold uppercase shrink-0">Hours:</span>
            {Object.entries(activityHoursSummary).map(([code, hrs]) => (
              <span
                key={code}
                className="bg-slate-100 border border-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-full shrink-0"
              >
                <strong className="text-blue-600">{code}</strong>: {hrs}h
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 2. Quick Assign Panel (Supports Multiple Activities + Hours) */}
      <section className="p-3">
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Assign (Bulk Apply)
            </div>
            {/* Quick preset chips */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => applyPreset("08:00", "17:00", 8)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700"
              >
                Full (8h)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("08:00", "12:00", 4)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700"
              >
                Half (4h)
              </button>
            </div>
          </div>

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                In Time
              </label>
              <input
                type="time"
                value={bulkIn}
                onChange={(e) => setBulkIn(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-1.5 bg-slate-50 text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-0.5">
                Out Time
              </label>
              <input
                type="time"
                value={bulkOut}
                onChange={(e) => setBulkOut(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-1.5 bg-slate-50 text-slate-800"
              />
            </div>
          </div>

          {/* Activities List for Quick Assign */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                Activities & Hours Allocation
              </label>
              <span className={`text-[10px] font-bold ${
                bulkAllocatedHours === bulkShiftHours 
                  ? "text-emerald-600" 
                  : bulkAllocatedHours > bulkShiftHours 
                    ? "text-red-600" 
                    : "text-amber-600"
              }`}>
                {bulkAllocatedHours} / {bulkShiftHours}h
              </span>
            </div>

            {bulkActivities.map((ba, index) => (
              <div key={ba.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                <span className="text-[10px] font-bold text-slate-400 w-4 text-center">
                  #{index + 1}
                </span>

                {/* Activity Code Dropdown */}
                <select
                  value={ba.activityCode}
                  onChange={(e) => updateBulkActivity(ba.id, "activityCode", e.target.value)}
                  className="flex-1 min-w-0 text-xs border border-slate-300 rounded p-1 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500"
                >
                  {ACTIVITIES.map((act) => (
                    <option key={act.code} value={act.code}>
                      {act.label}
                    </option>
                  ))}
                </select>

                {/* Hours Input directly in front of the activity */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={ba.hours === 0 ? "" : ba.hours}
                    onChange={(e) =>
                      updateBulkActivity(ba.id, "hours", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-14 text-xs font-bold text-right border border-slate-300 rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[11px] font-semibold text-slate-500">hrs</span>
                </div>

                {/* Delete button (if more than 1 activity) */}
                {bulkActivities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBulkActivity(ba.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition rounded"
                    title="Remove activity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Button to add another activity in Quick Assign */}
            <button
              type="button"
              onClick={addBulkActivity}
              className="w-full py-1.5 px-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Activity
            </button>
          </div>

          {/* Apply Button */}
          <button
            type="button"
            onClick={applyBulk}
            disabled={selectedIds.length === 0}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm ${
              selectedIds.length > 0
                ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Apply to Selected ({selectedIds.length} Workers)
          </button>
        </div>
      </section>

      {/* 3. Laborers List */}
      <section className="px-3 space-y-3 flex-1">
        {laborers.map((laborer) => {
          const isSelected = selectedIds.includes(laborer.id);
          const hasTime = laborer.inTime && laborer.outTime;
          const totalWorkerAllocated = laborer.activities.reduce(
            (acc, curr) => acc + (Number(curr.hours) || 0),
            0
          );
          const isBalanced = hasTime && totalWorkerAllocated === laborer.shiftHours;
          const isOverAllocated = totalWorkerAllocated > laborer.shiftHours;

          return (
            <div
              key={laborer.id}
              className={`bg-white rounded-xl p-3 border transition shadow-sm ${
                isSelected
                  ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10"
                  : "border-slate-200"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-2">
                <div
                  onClick={() => toggleSelect(laborer.id)}
                  className="flex items-center gap-2.5 cursor-pointer select-none"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 leading-none">
                      {laborer.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {laborer.id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      !hasTime
                        ? "bg-slate-100 text-slate-400"
                        : isBalanced
                        ? "bg-emerald-100 text-emerald-800"
                        : isOverAllocated
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {isBalanced ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : isOverAllocated ? (
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    ) : null}
                    {totalWorkerAllocated}h / {laborer.shiftHours}h
                  </span>
                </div>
              </div>

              {/* Shift In / Out Time Row */}
              <div className="flex items-center gap-2 py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg mb-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Shift:</span>
                <input
                  type="time"
                  value={laborer.inTime}
                  onChange={(e) => updateWorkerTimes(laborer.id, "inTime", e.target.value)}
                  className="bg-white border border-slate-200 rounded text-xs font-semibold px-1.5 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-400 text-xs font-bold">-</span>
                <input
                  type="time"
                  value={laborer.outTime}
                  onChange={(e) => updateWorkerTimes(laborer.id, "outTime", e.target.value)}
                  className="bg-white border border-slate-200 rounded text-xs font-semibold px-1.5 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="ml-auto text-[11px] font-bold text-slate-600">
                  {laborer.shiftHours} hrs
                </span>
              </div>

              {/* Activities Section for this Laborer */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between px-0.5 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  <span>Activity Code</span>
                  <span>Hours Worked</span>
                </div>

                {laborer.activities.map((alloc, idx) => (
                  <div
                    key={alloc.id}
                    className="flex items-center gap-1.5 bg-slate-50/70 border border-slate-200 rounded-lg p-1.5"
                  >
                    <span className="text-[10px] font-bold text-slate-400 w-3 text-center">
                      {idx + 1}.
                    </span>

                    {/* Activity Code Dropdown */}
                    <div className="flex-1 min-w-0 flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-1">
                      <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                      <select
                        value={alloc.activityCode}
                        onChange={(e) =>
                          updateWorkerActivity(laborer.id, alloc.id, "activityCode", e.target.value)
                        }
                        className="bg-transparent text-xs font-medium w-full focus:outline-none text-slate-700 truncate"
                      >
                        <option value="">Select Activity</option>
                        {ACTIVITIES.map((act) => (
                          <option key={act.code} value={act.code}>
                            {act.code} - {act.label.split("(")[1]?.replace(")", "") || act.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Hours Input directly in front of the activity code */}
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={alloc.hours === 0 ? "" : alloc.hours}
                        onChange={(e) =>
                          updateWorkerActivity(
                            laborer.id,
                            alloc.id,
                            "hours",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="w-14 text-xs font-bold text-right border border-slate-300 rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                      <span className="text-[11px] font-semibold text-slate-500">hrs</span>
                    </div>

                    {/* Delete button (only when more than 1 activity) */}
                    {laborer.activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorkerActivity(laborer.id, alloc.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition rounded"
                        title="Remove this activity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {/* + Add Activity Button for this Laborer */}
                <button
                  type="button"
                  onClick={() => addWorkerActivity(laborer.id)}
                  className="w-full py-1 px-2 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-blue-600 text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  Add Activity Code
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* 4. Sticky Bottom Submission Bar */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-3 shadow-lg flex items-center justify-between z-30">
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold">
            Ready to Submit
          </p>
          <p className="text-xs font-bold text-slate-800">
            {laborers.filter((l) => l.inTime && l.activities.some((a) => a.activityCode && a.hours > 0)).length} /{" "}
            {laborers.length} Complete
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            console.log("Submitting Laborer Activity Logs:", {
              date: selectedDate,
              totalHours: totalAllocatedHours,
              laborers: laborers.map((l) => ({
                id: l.id,
                name: l.name,
                inTime: l.inTime,
                outTime: l.outTime,
                shiftHours: l.shiftHours,
                activities: l.activities.filter((a) => a.activityCode && a.hours > 0),
              })),
            });
            alert("Attendance and multiple activities submitted successfully!");
          }}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          Submit Daily Log
        </button>
      </footer>
    </div>
  );
}