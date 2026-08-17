/**
 * SearchInput.tsx
 *
 * Debounced search input with Search icon. Used on every admin list page.
 *
 * Styled per design-system.json input_style:
 *   rounded-lg border border-slate-200 bg-white, focus:ring-2 ring-blue-600
 */
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Debounce delay in ms. Default 250. */
  debounce?: number;
}

export default function SearchInput({
  placeholder = 'Search…',
  value,
  onChange,
  debounce = 250,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);

  // Sync external value → local when parent resets
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce local → parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounce);
    return () => clearTimeout(timer);
  }, [local, debounce, onChange, value]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400"
      />
    </div>
  );
}
