import type { SyncContext, TallyConnector } from '@tallyui/core';

export interface ReceiptMailer { send(orderId: string, email: string): Promise<void> }

export function receiptMailer(connector: TallyConnector, context: () => SyncContext): ReceiptMailer | null {
  if (!connector.emailReceipt) return null;
  // Omit saveToBilling: saving a guest's email to the order requires asking first.
  return { send: (orderId, email) => connector.emailReceipt!(context(), orderId, email) };
}
