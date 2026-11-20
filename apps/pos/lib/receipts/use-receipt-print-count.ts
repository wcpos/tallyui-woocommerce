import { useEffect, useState } from 'react';
import { readReceiptPrints, recordReceiptPrint } from './receipt-prints';

// Every listener of one print (the sale's and Orders' sheets can share an order) gets the same Event: count each id once.
const counted = new WeakMap<Event, Set<string>>();

export function useReceiptPrintCount(orderId: string | null): number {
  const [state, setState] = useState<{ orderId: string | null; count: number }>({ orderId: null, count: 0 });

  useEffect(() => {
    if (orderId === null || typeof window === 'undefined') return;
    // The count persists on this device only; afterprint also fires when the dialog is cancelled.
    const onAfterPrint = (event: Event) => {
      const ids = counted.get(event) ?? new Set<string>();
      if (!ids.has(orderId)) { counted.set(event, ids.add(orderId)); recordReceiptPrint(orderId); }
      setState({ orderId, count: readReceiptPrints(orderId) });
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [orderId]);

  // Until this instance sees a print, the count is the stored one, so a reload keeps it.
  return state.orderId === orderId ? state.count : orderId === null ? 0 : readReceiptPrints(orderId);
}
