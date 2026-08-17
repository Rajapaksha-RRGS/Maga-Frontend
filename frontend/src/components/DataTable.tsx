/**
 * DataTable.tsx
 *
 * Generic typed table component — visible on md+ only (hidden below md).
 * Mobile counterpart is CardList.tsx.
 *
 * Styled per design-system.json:
 *   bg-white rounded-lg border border-slate-200, no shadow
 *   Header: bg-slate-50 text-xs uppercase tracking-wide text-slate-500
 *   Rows: text-sm text-slate-800, hover:bg-slate-50
 */
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  data,
  keyField,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={String(col.accessor)}
                className={[
                  'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide',
                  col.className ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={[
                'border-b border-slate-100 last:border-b-0 transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : '',
              ].join(' ')}
            >
              {columns.map((col) => (
                <td
                  key={String(col.accessor)}
                  className={['px-4 py-3 text-slate-800', col.className ?? ''].join(' ')}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[String(col.accessor)] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
