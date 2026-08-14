import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /** Optional semantic variant */
  variant?: 'default' | 'success' | 'warning';
}

const variantClasses: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'bg-white border-slate-200 text-slate-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const valueClasses: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'text-slate-900',
  success: 'text-green-700',
  warning: 'text-amber-700',
};

/**
 * StatCard — flat metric card used on the supervisor dashboard.
 * Flat surface, no shadow, high-contrast for outdoor/field readability.
 */
export function StatCard({
  label,
  value,
  icon,
  variant = 'default',
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 min-h-[88px] ${variantClasses[variant]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 leading-tight">
          {label}
        </span>
        {icon && (
          <span className="text-slate-400" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <span className={`text-3xl font-medium tabular-nums ${valueClasses[variant]}`}>
        {value}
      </span>
    </div>
  );
}
