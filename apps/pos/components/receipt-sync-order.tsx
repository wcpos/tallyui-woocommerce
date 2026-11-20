import { useEffect, useRef, useState, type JSX } from 'react';
import { Button, Text } from '@tallyui/components';
import { isRequeueable, type PosOrder } from '@tallyui/pos';
import { toast } from '../lib/toast/toast';

// v2 common.failed_to_save_order (core.json:657); v2 pos_cart.order_synced is core.json:34, :38.
export const SYNC_FAILED_TITLE = 'Failed to save order';

type SyncState = Pick<PosOrder, 'syncStatus' | 'serverRefs' | 'error'>;

/** v2 use-receipt-document.ts:100-102 shows the button when the sale is unsaved; here only a refusal requeue can resend. */
export function canSyncOrder(order: SyncState | undefined): boolean {
  if (!order || order.syncStatus !== 'rejected' || order.serverRefs?.orderId) return false;
  return isRequeueable(order.error?.code);
}

// v2 receipt-actions.tsx:24-38: "Save to store", disabled while it works; v2 hooks/use-sync-order.ts pushes the order again.
export function ReceiptSyncOrder({ posOrder, onRequeue }: {
  posOrder: Pick<PosOrder, 'id' | 'commandId' | 'syncStatus' | 'serverRefs' | 'error'> | undefined;
  onRequeue(orderIds: string[]): Promise<number>;
}): JSX.Element | null {
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  // The commandId at the press: requeue mints a new one, so a copy still carrying it is stale.
  const [watching, setWatching] = useState<string | null>(null);

  useEffect(() => {
    if (watching === null || !posOrder || posOrder.commandId === watching) return;
    const id = `sync-order-${posOrder.id}`;
    if (posOrder.syncStatus === 'applied' && posOrder.serverRefs?.orderId) {
      toast({ id, type: 'success', title: `Order #${posOrder.serverRefs.displayId ?? posOrder.serverRefs.orderId} synced` });
    } else if (posOrder.syncStatus === 'rejected') {
      toast({ id, type: 'error', title: SYNC_FAILED_TITLE });
    } else return; // pending: the store line already says "Awaiting store".
    guard.current = false;
    setWatching(null);
    setBusy(false);
  }, [watching, posOrder]);

  async function press() {
    if (guard.current || !posOrder) return;
    guard.current = true;
    setBusy(true);
    const { id, commandId } = posOrder;
    let count = 0;
    try { count = await onRequeue([id]); } catch { count = 0; }
    if (count > 0) { setWatching(commandId); return; }
    toast({ id: `sync-order-${id}`, type: 'error', title: SYNC_FAILED_TITLE });
    guard.current = false;
    setBusy(false);
  }

  // v2 use-receipt-document.ts:100-102: hidden while the order awaits the store; shown only for the call in flight.
  if (!canSyncOrder(posOrder) && !(busy && watching === null)) return null;
  return (
    <Button testID="receipt-sync-order-button" disabled={busy} onPress={() => { void press(); }}>
      <Text>Save to store</Text>
    </Button>
  );
}
