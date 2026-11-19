import type { JSX } from 'react';
import { Text } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';

// v2's receipt line (core.json:1354, :1367), the first line of the document: ADR 0040, the paper is never unaware.
export const AWAITING_STORE_LINE = 'Awaiting store · not yet confirmed';
export const NOT_SAVED_LINE = 'Not saved to the store · no order number';

type StoreState = Pick<PosOrder, 'syncStatus' | 'serverRefs'>;

/** v2 use-receipt-document.ts:100-108: awaiting while the outbox holds the sale; unsaved with no store id; none without a sale. */
export function receiptStoreLine(posOrder: StoreState | undefined): string | null {
  if (!posOrder) return null;
  if (posOrder.syncStatus === 'pending') return AWAITING_STORE_LINE;
  return posOrder.serverRefs?.orderId ? null : NOT_SAVED_LINE;
}

// v2 mark-awaiting-store.ts:10: centred, weight 700, 8 px under. TallyUI's Receipt has no header slot, so it sits just above.
export function ReceiptStoreLine({ posOrder }: { posOrder?: StoreState }): JSX.Element | null {
  const line = receiptStoreLine(posOrder);
  return line === null ? null : <Text testID="receipt-store-line" className="mb-2 text-center font-bold">{line}</Text>;
}
