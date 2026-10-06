import { useEffect, useState } from 'react';

export function useReceiptPrintCount(orderId: string | null): number {
  const [state, setState] = useState<{ orderId: string | null; count: number }>({ orderId: null, count: 0 });

  useEffect(() => {
    if (orderId === null || typeof window === 'undefined') return;
    // The count is in memory only; afterprint also fires when the dialog is cancelled.
    const onAfterPrint = () => setState(prev => ({ orderId, count: (prev.orderId === orderId ? prev.count : 0) + 1 }));
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [orderId]);

  return state.orderId === orderId ? state.count : 0;
}
