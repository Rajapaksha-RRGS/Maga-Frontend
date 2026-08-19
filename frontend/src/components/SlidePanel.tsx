/**
 * SlidePanel.tsx
 *
 * Modern clean blue slide-in overlay panel.
 * Automatically styles all child forms (inputs, labels, buttons, pickers)
 * to match the modern blue theme.
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
          className="fixed inset-0 bg-[#051120]/75 backdrop-blur-[2px] z-40 transition-opacity duration-300"
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
          'fixed top-0 right-0 h-full w-full max-w-md bg-gradient-to-b from-[#0e243f] via-[#0b1c33] to-[#081527] text-blue-50 border-l border-blue-500/25 shadow-2xl shadow-blue-950/80 z-50',
          'flex flex-col transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-400/15 bg-[#122b4a]/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" />
            <h2 className="text-base font-semibold text-white tracking-wide">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-200/70 hover:text-white hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content with theme cascade for all child form elements */}
        <div
          className={[
            'flex-1 overflow-y-auto px-5 py-6',
            // Labels
            '[&_label]:text-blue-200/90 [&_label]:font-medium',
            // Text, Number, Password Inputs & Textarea
            '[&_input[type="text"]]:bg-[#132c4a]/80 [&_input[type="text"]]:border-blue-400/25 [&_input[type="text"]]:text-white [&_input[type="text"]]:placeholder:text-blue-300/40 [&_input[type="text"]]:focus:border-blue-400 [&_input[type="text"]]:focus:ring-blue-400/25 [&_input[type="text"]]:focus:bg-[#163458]',
            '[&_input[type="password"]]:bg-[#132c4a]/80 [&_input[type="password"]]:border-blue-400/25 [&_input[type="password"]]:text-white [&_input[type="password"]]:placeholder:text-blue-300/40 [&_input[type="password"]]:focus:border-blue-400 [&_input[type="password"]]:focus:ring-blue-400/25 [&_input[type="password"]]:focus:bg-[#163458]',
            '[&_input[type="number"]]:bg-[#132c4a]/80 [&_input[type="number"]]:border-blue-400/25 [&_input[type="number"]]:text-white [&_input[type="number"]]:placeholder:text-blue-300/40 [&_input[type="number"]]:focus:border-blue-400 [&_input[type="number"]]:focus:ring-blue-400/25 [&_input[type="number"]]:focus:bg-[#163458]',
            '[&_select]:bg-[#132c4a]/80 [&_select]:border-blue-400/25 [&_select]:text-white [&_select]:focus:border-blue-400 [&_select]:focus:bg-[#163458]',
            '[&_textarea]:bg-[#132c4a]/80 [&_textarea]:border-blue-400/25 [&_textarea]:text-white [&_textarea]:placeholder:text-blue-300/40 [&_textarea]:focus:border-blue-400 [&_textarea]:focus:bg-[#163458]',
            // Checkbox and spans
            '[&_input[type="checkbox"]]:bg-[#132c4a] [&_input[type="checkbox"]]:border-blue-400/40 [&_input[type="checkbox"]]:accent-blue-500',
            '[&_label_span]:text-blue-100',
            // Nested picker containers & buttons (e.g. SupervisorForm employee search)
            '[&_div.border-slate-200]:border-blue-400/25 [&_div.border-slate-200]:bg-[#0d223c]/90',
            '[&_.max-h-40_button]:text-blue-100 [&_.max-h-40_button:hover]:bg-blue-600/30',
            '[&_button.bg-blue-50]:bg-blue-600/40 [&_button.text-blue-700]:text-blue-100 [&_button.text-blue-700]:font-medium',
            // Helper paragraphs
            '[&_p.text-slate-400]:text-blue-300/60',
            '[&_p.text-slate-500]:text-blue-200/80',
            '[&_span.text-slate-400]:text-blue-300/50',
            // Submit Button (Primary)
            '[&_button[type="submit"]]:bg-blue-600 [&_button[type="submit"]]:hover:bg-blue-500 [&_button[type="submit"]]:active:bg-blue-700 [&_button[type="submit"]]:text-white [&_button[type="submit"]]:shadow-md [&_button[type="submit"]]:shadow-blue-950/40',
            '[&_button[type="submit"]:disabled]:bg-blue-950/60 [&_button[type="submit"]:disabled]:text-blue-300/40 [&_button[type="submit"]:disabled]:border [&_button[type="submit"]:disabled]:border-blue-500/10',
            // Secondary / Outlined button (Deactivate / Delete)
            '[&_button.border-slate-200]:border-blue-400/25 [&_button.border-slate-200]:text-blue-100 [&_button.border-slate-200]:bg-[#142f52]/40 [&_button.border-slate-200]:hover:bg-blue-600/30',
            // Cancel button
            '[&_button.text-slate-500]:text-blue-300/70 [&_button.text-slate-500]:hover:text-white',
            // Alerts / error boxes inside forms
            '[&_div.bg-amber-50]:bg-amber-950/40 [&_div.border-amber-200]:border-amber-500/40 [&_p.text-amber-700]:text-amber-200',
          ].join(' ')}
        >
          {children}
        </div>
      </div>
    </>
  );
}
