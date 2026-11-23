import { useEffect, useState } from 'react';
import type { RxCollection } from 'rxdb';
import { knownWarnings } from '@tallyui/core';
import { watchFresh, type PosOrder } from '@tallyui/pos';

export type TotalMismatchRow = { order: PosOrder; expectedMinor: number; serverMinor: number };

/**
 * The sales a WCPOS 1.10.x store accepted at a different total, newest first: `expectedMinor` is what the till charged,
 * `serverMinor` what the store recorded. Only a valid warning counts (`knownWarnings`). A row marked handled for the
 * order's current `commandId` is left out; a requeue mints a new one, so it shows again (ADR-092 6f). A failed read
 * shows none: the band has no error state.
 */
export function useTotalMismatchOrders(orders: RxCollection<PosOrder> | null): TotalMismatchRow[] {
  const [rows, setRows] = useState<TotalMismatchRow[]>([]);
  useEffect(() => {
    if (!orders) { setRows([]); return; }
    const selector = { syncStatus: 'applied', warnings: { $elemMatch: { code: 'total_mismatch' } } } as const;
    const subscription = watchFresh(orders, { selector, sort: [{ createdAt: 'desc' }] }).subscribe({
      next: next => setRows(next.flatMap(order => {
        const warning = knownWarnings(order.warnings).find(w => w.code === 'total_mismatch');
        const handled = order.attentionHandledFor !== undefined && order.attentionHandledFor === order.commandId;
        return warning?.code === 'total_mismatch' && !handled
          ? [{ order, expectedMinor: warning.expectedMinor, serverMinor: warning.serverMinor }] : [];
      })),
      error: () => setRows([]),
    });
    return () => subscription.unsubscribe();
  }, [orders]);
  return rows;
}
