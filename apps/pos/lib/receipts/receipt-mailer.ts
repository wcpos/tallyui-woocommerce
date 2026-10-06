import type { SyncContext, TallyConnector } from '@tallyui/core';

export interface ReceiptMailer { send(orderId: string, email: string): Promise<void> }

// The name and signature follow the G4 write-up; adjust when G4 lands.
type EmailConnector = TallyConnector & {
  emailReceipt?: (context: SyncContext, orderId: string, email: string) => Promise<void>;
};

export function receiptMailer(connector: TallyConnector, context: () => SyncContext): ReceiptMailer | null {
  const source = connector as EmailConnector;
  if (!source.emailReceipt) return null;
  return { send: (orderId, email) => source.emailReceipt!(context(), orderId, email) };
}
