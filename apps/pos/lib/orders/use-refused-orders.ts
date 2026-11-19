import { useEffect, useState } from 'react';
import type { RxCollection } from 'rxdb';
import { isReopened, watchFresh, type PosOrder } from '@tallyui/pos';

export type RefusedOrdersRead = { rows: PosOrder[]; readError: boolean };

/**
 * The sales the store refused, newest first, or the fact that they could not be read (v2 use-rejected-mutations.ts:109-129:
 * "cannot read" must never look like "none refused"). A failed read carries no rows; the next good emission clears it.
 * A reopened refusal lives on as a parked sale and is left out (ADR-077 d4b).
 */
export function useRefusedOrdersRead(orders: RxCollection<PosOrder> | null): RefusedOrdersRead {
  const [read, setRead] = useState<RefusedOrdersRead>({ rows: [], readError: false });
  useEffect(() => {
    if (!orders) { setRead({ rows: [], readError: false }); return; }
    const subscription = watchFresh(orders, { selector: { syncStatus: 'rejected' }, sort: [{ createdAt: 'desc' }] }).subscribe({
      next: next => setRead({ rows: next.filter(order => !isReopened(order)), readError: false }),
      error: () => setRead({ rows: [], readError: true }),
    });
    return () => subscription.unsubscribe();
  }, [orders]);
  return read;
}

/** The sales the store refused, newest first. */
export function useRefusedOrders(orders: RxCollection<PosOrder> | null): PosOrder[] { return useRefusedOrdersRead(orders).rows; }

/** The store's own reason for a refusal, or the fallback sentence. */
export function refusedReason(order: PosOrder): string { return (order.error && [order.error.code, order.error.message].filter(Boolean).join(' · ')) || 'Your server refused it without saying why.'; }
