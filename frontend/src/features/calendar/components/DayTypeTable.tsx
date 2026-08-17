/**
 * DayTypeTable.tsx — Compact CRUD table for day types (name + rate multiplier).
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { DayType, DayTypeFormData } from '../services/calendarService';

interface Props {
  dayTypes: DayType[];
  onAdd: (data: DayTypeFormData) => Promise<void>;
  onEdit: (id: string, data: Partial<DayTypeFormData>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const INPUT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function DayTypeTable({ dayTypes, onAdd, onEdit, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('1.0');

  const startEdit = (dt: DayType) => {
    setEditingId(dt.id);
    setEditName(dt.name);
    setEditRate(String(dt.rateMultiplier));
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async () => {
    if (editingId && editName.trim()) {
      await onEdit(editingId, { name: editName.trim(), rateMultiplier: parseFloat(editRate) || 1.0 });
      setEditingId(null);
    }
  };

  const saveNew = async () => {
    if (newName.trim()) {
      await onAdd({ name: newName.trim(), rateMultiplier: parseFloat(newRate) || 1.0 });
      setNewName('');
      setNewRate('1.0');
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-800">Day types</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 active:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Rate</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide w-20"></th>
          </tr>
        </thead>
        <tbody>
          {dayTypes.map((dt) => (
            <tr key={dt.id} className="border-b border-slate-100 last:border-b-0">
              {editingId === dt.id ? (
                <>
                  <td className="px-4 py-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`${INPUT_CLASS} w-full`} />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" step="0.1" min="0" value={editRate} onChange={(e) => setEditRate(e.target.value)} className={`${INPUT_CLASS} w-20 font-mono`} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={saveEdit} className="w-8 h-8 rounded-md flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"><Check size={14} /></button>
                      <button onClick={cancelEdit} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"><X size={14} /></button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2 text-slate-800">{dt.name}</td>
                  <td className="px-4 py-2 font-mono text-slate-600">×{dt.rateMultiplier}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(dt)} title="Edit" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(dt.id)} title="Delete" className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}

          {/* Add row */}
          {adding && (
            <tr className="border-b border-slate-100 bg-blue-50/50">
              <td className="px-4 py-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Day type name" className={`${INPUT_CLASS} w-full`} autoFocus />
              </td>
              <td className="px-4 py-2">
                <input type="number" step="0.1" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value)} className={`${INPUT_CLASS} w-20 font-mono`} />
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={saveNew} className="w-8 h-8 rounded-md flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"><Check size={14} /></button>
                  <button onClick={() => setAdding(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"><X size={14} /></button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
