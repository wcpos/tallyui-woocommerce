// A table's sort: the column it sorts on and the direction, as v2's data-table holds `sortBy` and `sortDirection`.
export interface TableSort<F extends string> { field: F; direction: 'asc' | 'desc' }

// v2 packages/components/src/data-table/header.tsx: the sorted column flips, another column starts ascending.
export function nextSort<F extends string>(current: TableSort<F>, field: F): TableSort<F> {
  if (current.field === field) return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { field, direction: 'asc' };
}
