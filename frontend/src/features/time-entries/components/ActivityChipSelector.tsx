import type { ActivityCode } from '../services/timeEntryService';

interface ActivityChipSelectorProps {
  codes: ActivityCode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * ActivityChipSelector — horizontally scrollable row of activity code chips.
 *
 * Activity codes render in monospace font (they read like equipment tags).
 * Selected chip: blue-700 background + white text.
 * Unselected: white background, slate border.
 *
 * Uses role="listbox" + role="option" for screen reader semantics.
 */
export function ActivityChipSelector({
  codes,
  selectedId,
  onSelect,
}: ActivityChipSelectorProps) {
  return (
    <div>
      <div
        role="listbox"
        aria-label="Activity codes"
        aria-orientation="horizontal"
        className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {codes.map((code) => {
          const isSelected = code.id === selectedId;
          return (
            <button
              key={code.id}
              role="option"
              aria-selected={isSelected}
              type="button"
              onClick={() => onSelect(code.id)}
              className={[
                'flex-shrink-0 snap-start px-3 py-2 rounded-md border',
                'min-h-[44px] flex flex-col items-start justify-center',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                isSelected
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50',
              ].join(' ')}
            >
              <span className="font-mono text-sm font-medium leading-none">
                {code.code}
              </span>
              <span
                className={`text-xs leading-tight mt-0.5 max-w-[120px] truncate ${
                  isSelected ? 'text-blue-100' : 'text-slate-500'
                }`}
              >
                {code.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
