/**
 * StatusBadge.tsx
 *
 * Pill badge for active/inactive entity status.
 *
 * Styled per design-system.json chip_style.status_badge:
 *   rounded-full px-2 py-0.5 text-xs font-medium
 *   active:  text-green-700 bg-green-50 border border-green-200
 *   inactive: text-slate-500 bg-slate-100 border border-slate-200
 */

interface StatusBadgeProps {
  status: 'active' | 'inactive';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isActive = status === 'active';
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium border',
        isActive
          ? 'text-green-700 bg-green-50 border-green-200'
          : 'text-slate-500 bg-slate-100 border-slate-200',
      ].join(' ')}
    >
      {isActive ? 'active' : 'inactive'}
    </span>
  );
}
