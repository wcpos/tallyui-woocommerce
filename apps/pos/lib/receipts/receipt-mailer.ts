import type { SyncContext, TallyConnector } from '@tallyui/core';

export interface ReceiptMailer { send(orderId: string, email: string, options?: { saveToBilling?: boolean }): Promise<void> }

export function receiptMailer(connector: TallyConnector, context: () => SyncContext): ReceiptMailer | null {
  if (!connector.emailReceipt) return null;
  // saveToBilling only when the cashier switched it on in the Email Receipt dialog:
  // saving a guest's address to the order's billing email needs their say-so.
  return { send: (orderId, email, options) => options?.saveToBilling
    ? connector.emailReceipt!(context(), orderId, email, { saveToBilling: true })
    : connector.emailReceipt!(context(), orderId, email) };
}
