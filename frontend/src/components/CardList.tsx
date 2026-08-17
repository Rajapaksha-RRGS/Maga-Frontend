/**
 * CardList.tsx
 *
 * Generic card-list for mobile — visible below md only (hidden on md+).
 * Desktop counterpart is DataTable.tsx.
 *
 * Styled per design-system.json:
 *   space-y-2 gap between cards (employee_row pattern)
 */
import type { ReactNode } from 'react';

interface CardListProps<T> {
  data: T[];
  keyField: keyof T;
  renderCard: (item: T) => ReactNode;
}

export default function CardList<T>({
  data,
  keyField,
  renderCard,
}: CardListProps<T>) {
  return (
    <div className="md:hidden space-y-2">
      {data.map((item) => (
        <div key={String(item[keyField])}>{renderCard(item)}</div>
      ))}
    </div>
  );
}
