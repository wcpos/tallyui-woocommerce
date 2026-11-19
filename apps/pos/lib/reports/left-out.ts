import { useCallback, useState } from 'react';

/**
 * The orders the cashier unticked in the Orders table, by id (v2 reports/context.tsx:249 `unselectedRowIds`).
 * Session state for the visit: v2 keeps it in `ReportsProvider`, unkeyed, and nothing resets it, so it survives a
 * range or cashier change; only orders in the current range count as left out (v2 hero `useLeftOutCount`).
 */
export function useLeftOut() {
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(() => new Set());
  // v2 orders-panel.tsx `toggle`: ticking includes the ids, unticking leaves them out.
  const include = useCallback((ids: readonly string[], included: boolean) => setLeftOut(previous => {
    const next = new Set(previous);
    for (const id of ids) {
      if (included) next.delete(id);
      else next.add(id);
    }
    return next;
  }), []);
  // v2 hero `LeftOutChip` "Put them back": `setUnselectedRowIds({})`.
  const clear = useCallback(() => setLeftOut(new Set()), []);
  return { leftOut, include, clear };
}
