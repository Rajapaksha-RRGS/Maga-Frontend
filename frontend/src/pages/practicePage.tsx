// frontend/src/pages/PracticePage.tsx

import React, { useState, useEffect } from 'react';
import { api } from '../config/api';
import { RefreshCw, Database, AlertCircle } from 'lucide-react';

interface PracticeItem {
  id: string;
  code: string;
  description: string;
  unit: string | null;
}

export default function PracticePage() {
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Backend API එකෙන් Data Fetch කරන Function එක
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Backend එකේ අපි හදපු /api/practice/my-data එකට call කිරීම
      const res = await api.get('/practice/my-data');
      if (res.data?.success) {
        setItems(res.data.items || []);
      } else {
        setError('Data fetch කිරීම අසාර්ථක විය.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err?.message || 'Backend එක සමඟ සම්බන්ධ වීමට නොහැකි විය.');
    } finally {
      setIsLoading(false);
    }
  };

  // Page එක Load වෙද්දී ස්වයංක්‍රීයව දත්ත ලබා ගැනීම
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Database size={24} />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                My Practice Table
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Prisma Backend API එකෙන් Load වන Activity Codes දත්ත ලැයිස්තුව
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-xl transition shadow-sm"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">Activity Code</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 w-28 text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  // Loading Skeleton
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4 text-center"><div className="h-4 bg-slate-200 rounded w-6 mx-auto" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-3/4" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  // Empty State
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      දත්ත කිසිවක් හමු නොවීය.
                    </td>
                  </tr>
                ) : (
                  // Real Data Rows
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                        <span className="bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md text-xs">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">
                          {item.unit || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar */}
          {!isLoading && items.length > 0 && (
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>පෙන්වා ඇති අයිතම ගණන: <strong>{items.length}</strong></span>
              <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                Live Database Connected
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}