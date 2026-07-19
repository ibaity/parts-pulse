import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SortHeader({ label, sortKey, activeKey, direction, onSort, align = 'left' }) {
  const isActive = sortKey === activeKey;
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={cn('p-2 font-medium whitespace-nowrap', alignClass)}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-primary transition-colors w-full',
          alignClass,
          isActive && 'text-primary'
        )}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}