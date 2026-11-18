import React, { useState, useEffect, useRef } from 'react';

export interface TimeInput24Props {
  value: string | undefined | null; // "HH:mm" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  id?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

/**
 * Normalizes any raw time string or digit sequence to a guaranteed 24-hour "HH:mm" string.
 * Examples:
 *   "1700"  -> "17:00"
 *   "700"   -> "07:00"
 *   "7"     -> "07:00"
 *   "17"    -> "17:00"
 *   "7:30"  -> "07:30"
 *   "2500"  -> "23:00" (clamped)
 *   ""      -> ""
 */
export function normalizeTime24(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return '';
  const clean = raw.trim();
  let h = 0;
  let m = 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    h = parseInt(parts[0] || '0', 10);
    m = parseInt(parts[1] || '0', 10);
  } else {
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) {
      h = parseInt(digits, 10);
      m = 0;
    } else if (digits.length === 3) {
      h = parseInt(digits.slice(0, 1), 10);
      m = parseInt(digits.slice(1), 10);
    } else {
      h = parseInt(digits.slice(0, 2), 10);
      m = parseInt(digits.slice(2, 4), 10);
    }
  }

  if (isNaN(h)) h = 0;
  if (isNaN(m)) m = 0;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Steps time forward or backward by a delta in minutes.
 */
function stepMinutes(val: string, deltaMinutes: number): string {
  const norm = normalizeTime24(val) || '07:00';
  const [h, m] = norm.split(':').map(Number);
  let total = h * 60 + m + deltaMinutes;
  if (total < 0) total += 1440;
  total = total % 1440;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Formats user input progressively as they type 24-hour digits without getting stuck.
 */
function formatLiveTyping(input: string, prev: string): string {
  // If user is deleting characters
  if (input.length < prev.length) {
    if (prev.endsWith(':') && input === prev.slice(0, -1)) {
      return input.slice(0, -1);
    }
    return input;
  }

  const clean = input.replace(/[^0-9:]/g, '');
  if (!clean) return '';

  // If input already contains a colon
  if (clean.includes(':')) {
    const [h, m] = clean.split(':');
    let hStr = h.slice(0, 2);
    let mStr = (m || '').slice(0, 2);

    if (hStr.length === 2 && parseInt(hStr, 10) > 23) {
      hStr = '23';
    }
    if (mStr.length > 0 && parseInt(mStr[0], 10) > 5) {
      mStr = '5' + mStr.slice(1);
    }
    if (mStr.length === 2 && parseInt(mStr, 10) > 59) {
      mStr = '59';
    }
    return m !== undefined ? `${hStr}:${mStr}` : hStr;
  }

  // Only digits entered so far
  const digits = clean.replace(/\D/g, '').slice(0, 4);

  if (digits.length === 1) {
    const d = parseInt(digits, 10);
    // In 24h clock, hours starting with 3..9 must be 03..09
    if (d >= 3) return `0${d}:`;
    return digits;
  }

  if (digits.length === 2) {
    let d = parseInt(digits, 10);
    if (d > 23) d = 23;
    return `${String(d).padStart(2, '0')}:`;
  }

  if (digits.length === 3) {
    let h = parseInt(digits.slice(0, 2), 10);
    if (h > 23) h = 23;
    let m1 = parseInt(digits.slice(2, 3), 10);
    if (m1 > 5) m1 = 5;
    return `${String(h).padStart(2, '0')}:${m1}`;
  }

  if (digits.length === 4) {
    let h = parseInt(digits.slice(0, 2), 10);
    if (h > 23) h = 23;
    let m = parseInt(digits.slice(2, 4), 10);
    if (m > 59) m = 59;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return clean;
}

/**
 * TimeInput24:
 * A pure 24-Hour (HH:mm) time input component designed for construction sites and Mäga ERP.
 * Works uniformly across all operating systems, browsers, and mobile devices without AM/PM.
 */
export const TimeInput24: React.FC<TimeInput24Props> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'HH:mm',
  title = '24-Hour time (HH:mm, e.g. 07:00, 17:00). Use ↑/↓ to adjust.',
  id,
  autoFocus = false,
  'aria-label': ariaLabel,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => value || '');
  const isInternalChange = useRef<boolean>(false);

  // Sync external value changes into internal displayValue
  useEffect(() => {
    if (!isInternalChange.current) {
      setDisplayValue(value || '');
    }
    isInternalChange.current = false;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatLiveTyping(raw, displayValue);
    setDisplayValue(formatted);
    isInternalChange.current = true;

    if (formatted === '') {
      onChange('');
    } else if (formatted.length === 5 && formatted.includes(':')) {
      onChange(formatted);
    }
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      setDisplayValue('');
      if (value !== '') onChange('');
      return;
    }

    const normalized = normalizeTime24(displayValue);
    setDisplayValue(normalized);
    if (normalized !== value) {
      isInternalChange.current = true;
      onChange(normalized);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.shiftKey ? 60 : 15;
      const nextTime = stepMinutes(displayValue || value || '07:00', delta);
      setDisplayValue(nextTime);
      isInternalChange.current = true;
      onChange(nextTime);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.shiftKey ? -60 : -15;
      const prevTime = stepMinutes(displayValue || value || '07:00', delta);
      setDisplayValue(prevTime);
      isInternalChange.current = true;
      onChange(prevTime);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      disabled={disabled}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      title={title}
      autoFocus={autoFocus}
      aria-label={ariaLabel || title}
      maxLength={5}
      className={className}
    />
  );
};

export default TimeInput24;

