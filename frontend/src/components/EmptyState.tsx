/**
 * EmptyState.tsx
 *
 * Centered empty-state message with optional icon.
 *
 * Styled per design-system.json:
 *   text-slate-400 text-sm, py-8
 */
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  icon?: ReactNode;
}

export default function EmptyState({
  message = 'No data to display.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <span className="text-slate-300">
        {icon ?? <Inbox size={32} />}
      </span>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
