import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  // Prepend Admin if not explicitly given
  const fullItems: BreadcrumbItem[] =
    items.length > 0 && items[0].label === 'Admin'
      ? items
      : [{ label: 'Admin', to: '/admin' }, ...items];

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs text-slate-400 font-medium ${className}`}>
      {fullItems.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === fullItems.length - 1;

        return (
          <div key={index} className="flex items-center gap-1.5">
            {!isFirst && <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="hover:text-blue-600 text-slate-500 transition-colors flex items-center gap-1"
              >
                {isFirst && <Home size={12} className="text-slate-400" />}
                <span>{item.label}</span>
              </Link>
            ) : item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-blue-600 text-slate-500 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isFirst && <Home size={12} className="text-slate-400" />}
                <span>{item.label}</span>
              </button>
            ) : (
              <span className={`flex items-center gap-1 ${isLast ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>
                {isFirst && <Home size={12} className="text-slate-400" />}
                <span>{item.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
