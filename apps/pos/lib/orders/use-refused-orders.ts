import { useEffect, useState } from 'react';
import type { RxCollection } from 'rxdb';
import { isReopened, watchFresh, type PosOrder } from '@tallyui/pos';

/** The sales the store refused, newest first. A reopened refusal lives on as a parked sale and is left out (ADR-077 d4b). */
export function useRefusedOrders(orders: RxCollection<PosOrder> | null): PosOrder[] {
  const [rows, setRows] = useState<PosOrder[]>([]);
  useEffect(() => {
    if (!orders) { setRows([]); return; }
    const subscription = watchFresh(orders, { selector: { syncStatus: 'rejected' }, sort: [{ createdAt: 'desc' }] }).subscribe(next => setRows(next.filter(order => !isReopened(order))));
    return () => subscription.unsubscribe();
  }, [orders]);
  return rows;
}

/** The store's own reason for a refusal, or the fallback sentence. */
export function refusedReason(order: PosOrder): string { return (order.error && [order.error.code, order.error.message].filter(Boolean).join(' · ')) || 'Your server refused it without saying why.'; }
