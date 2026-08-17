/**
 * StatCard.tsx
 *
 * Stat card matching design-system.json component_dna.card_style.stat_card:
 *   rounded-lg border p-4 min-h-[88px] flex flex-col gap-2
 *   Default: bg-white border-slate-200
 *   Success: bg-green-50 border-green-200
 *   Warning: bg-amber-50 border-amber-200
 *   No shadow.
 */

interface StatCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'warning';
}

const VARIANT_CLASSES = {
  default: 'bg-white border-slate-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
} as const;

const VALUE_CLASSES = {
  default: 'text-slate-900',
  success: 'text-green-700',
  warning: 'text-amber-800',
} as const;

export default function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={[
        'rounded-lg border p-4 min-h-[88px] flex flex-col gap-2',
        VARIANT_CLASSES[variant],
      ].join(' ')}
    >
      <span className="text-sm text-slate-500">{label}</span>
      <span className={['text-3xl font-medium tabular-nums', VALUE_CLASSES[variant]].join(' ')}>
        {value}
      </span>
    </div>
  );
}
