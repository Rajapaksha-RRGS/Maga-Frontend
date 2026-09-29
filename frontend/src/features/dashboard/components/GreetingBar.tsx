/**
 * GreetingBar.tsx
 *
 * Top greeting area on the admin dashboard.
 * Shows a time-based greeting, user's name, and today's date.
 */
import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Sun, Sunset, Moon, CalendarDays } from 'lucide-react';

function getGreeting(): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', Icon: Sun };
  if (h < 17) return { text: 'Good afternoon', Icon: Sun };
  if (h < 20) return { text: 'Good evening', Icon: Sunset };
  return { text: 'Good night', Icon: Moon };
}

const todayFormatted = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

export default function GreetingBar() {
  const { user } = useAuth();
  const { text, Icon } = useMemo(() => getGreeting(), []);

  const displayName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'Admin';

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Icon size={18} className="text-emerald-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-slate-800">
            {text}, {displayName}!
          </h1>
        </div>
        <p className="text-sm text-slate-500 ml-0">
          Here's what's happening on-site today.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm self-start sm:self-auto">
        <CalendarDays size={13} className="text-blue-500" />
        <span>{todayFormatted}</span>
      </div>
    </div>
  );
}
