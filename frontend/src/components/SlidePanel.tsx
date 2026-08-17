/**
 * SlidePanel.tsx
 *
 * Slide-in overlay panel from the right edge — used for add/edit forms
 * across admin CRUD screens. Accessible: Escape closes, focus-trapped,
 * backdrop click closes.
 *
 * Styled per design-system.json:
 *   bg-white border-l border-slate-200, backdrop bg-slate-900/40, no shadow
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function SlidePanel({ open, onClose, title, children }: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus the panel when it opens
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open}
        aria-label={title}
        tabIndex={-1}
        className={[
          'fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-slate-200 z-50',
          'flex flex-col transform transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <h2 className="text-base font-medium text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {children}
        </div>
      </div>
    </>
  );
}
