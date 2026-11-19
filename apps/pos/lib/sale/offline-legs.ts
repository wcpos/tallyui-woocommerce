import { useCallback, useState } from 'react';

const NONE: ReadonlySet<string> = new Set();

/**
 * The legs of the current sale taken while offline, by payment id: v2's ledger `row.recorded_offline`
 * (checkout/tender/ledger-pane.tsx:287-293). TallyUI's Payment has no offline flag, so the mark is app-local
 * React state, never stored; it is keyed by the order id, so a new sale starts with none marked.
 */
export function useOfflineLegs(orderId: string): { ids: ReadonlySet<string>; mark(paymentId: string): void } {
  const [marked, setMarked] = useState<{ orderId: string; ids: ReadonlySet<string> }>({ orderId, ids: NONE });
  const mark = useCallback((paymentId: string) => setMarked(prev =>
    ({ orderId, ids: new Set(prev.orderId === orderId ? prev.ids : NONE).add(paymentId) })), [orderId]);
  return { ids: marked.orderId === orderId ? marked.ids : NONE, mark };
}
