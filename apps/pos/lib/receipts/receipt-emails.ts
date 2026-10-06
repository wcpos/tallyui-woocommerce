import { useEffect } from 'react';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import type { ReceiptMailer } from './receipt-mailer';

export interface ReceiptEmail {
  id: string;
  email: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  queuedAt: string;
  sentAt?: string;
  error?: string;
}

export type ReceiptEmailCollection = RxCollection<ReceiptEmail>;
export const receiptEmailSchema: RxJsonSchema<ReceiptEmail> = {
  version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    email: { type: 'string' },
    status: { type: 'string', enum: ['queued', 'sending', 'sent', 'failed'] },
    queuedAt: { type: 'string', maxLength: 32 },
    sentAt: { type: 'string' }, error: { type: 'string' },
  },
  required: ['id', 'email', 'status', 'queuedAt'],
  indexes: ['queuedAt'],
};

export async function queueReceiptEmail(collection: ReceiptEmailCollection, orderId: string, email: string, now = new Date()) {
  const trimmed = email.trim();
  if (!trimmed.includes('@')) throw new Error('Enter an email address');
  return collection.upsert({ id: orderId, email: trimmed, status: 'queued', queuedAt: now.toISOString() });
}

export function useReceiptEmailSender({ collection, mailer, orders }: {
  collection: ReceiptEmailCollection | null; mailer: ReceiptMailer | null; orders: RxCollection<PosOrder> | null;
}) {
  useEffect(() => {
    if (!collection || !mailer || !orders) return;
    let stopped = false, ready = false, running = false, pending = false;
    async function tick() {
      if (stopped || !ready) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        const docs = await collection!.find({ selector: { status: 'queued' }, sort: [{ queuedAt: 'asc' }] }).exec();
        for (const doc of docs) {
          if (stopped) return;
          const order = await orders!.findOne(doc.id).exec();
          const orderId = order?.serverRefs?.orderId;
          if (!orderId || stopped || navigator.onLine === false || doc.getLatest().status !== 'queued') continue;
          await doc.incrementalPatch({ status: 'sending' });
          if (stopped) return;
          try {
            await mailer!.send(orderId, doc.email);
            await doc.incrementalPatch({ status: 'sent', sentAt: new Date().toISOString() });
          } catch (cause) {
            await doc.incrementalPatch({ status: 'failed', error: cause instanceof ConnectorUnauthorizedError
              ? 'Sign in again to send the receipt'
              : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused the email: ${cause.message}`
              : cause instanceof CustomerServiceError && cause.code === 'network'
                ? 'Could not reach the store. The email may not have been sent; send again to retry.'
              : cause instanceof CustomerServiceError && cause.code === 'server'
                ? `The store could not send the email (${cause.message}). Send again to retry.`
              : cause instanceof Error ? cause.message : String(cause) });
          }
        }
      } finally {
        running = false;
        if (pending) { pending = false; void tick(); }
      }
    }
    const queueChanges = collection.$.subscribe(() => { void tick(); });
    const orderChanges = orders.$.subscribe(() => { void tick(); });
    const online = () => { void tick(); };
    window.addEventListener('online', online);
    const interval = setInterval(online, 30_000);
    void (async () => {
      const interrupted = await collection.find({ selector: { status: 'sending' } }).exec();
      for (const doc of interrupted) {
        if (stopped) return;
        await doc.incrementalPatch({ status: 'failed', error: 'This email may not have been sent. Send again to retry.' });
      }
      ready = true;
      await tick();
    })();
    return () => {
      stopped = true;
      queueChanges.unsubscribe();
      orderChanges.unsubscribe();
      window.removeEventListener('online', online);
      clearInterval(interval);
    };
  }, [collection, mailer, orders]);
}
