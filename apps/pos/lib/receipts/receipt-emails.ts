import { useEffect } from 'react';
import type { PosOrder } from '@tallyui/pos';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import type { ReceiptMailer } from './receipt-mailer';
import { classifyEmailSendError, type EmailSendFailure } from './classify-email-error';

/** v2 packages/utils/src/outbox-backoff.ts: give up after this many sends; the row becomes failed. */
export const MAX_SEND_ATTEMPTS = 6;
/** v2 outbox-backoff.ts: the first retry lands 30 s after the failure, doubling from there. */
export const BASE_BACKOFF_MS = 30_000;
/** v2 outbox-backoff.ts: ceiling, so a till offline overnight retries every 15 minutes. */
export const MAX_BACKOFF_MS = 15 * 60_000;
/** v2 packages/query/src/receipt-email-queue/queue.ts: spacing between two sends in one pass. */
export const SEND_SPACING_MS = 1_000;
export function backoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.min(exponent, 20), MAX_BACKOFF_MS);
}

const defaultNow = () => Date.now();
const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// ids this JS process is posting now; a remounted sender must not requeue or re-post them, v2 queue.ts `claimedRows`.
const inFlight = new WeakMap<ReceiptEmailCollection, Set<string>>();
function claims(collection: ReceiptEmailCollection) {
  let claimed = inFlight.get(collection);
  if (!claimed) { claimed = new Set<string>(); inFlight.set(collection, claimed); }
  return claimed;
}

export interface ReceiptEmail {
  id: string;
  email: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  queuedAt: string;
  attempts: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  /** v2 receipt/email.tsx "Save email to Billing Address"; read by the sender in a later job. */
  saveToBilling?: boolean;
  sentAt?: string;
  error?: string;
}

export type ReceiptEmailCollection = RxCollection<ReceiptEmail>;
export const receiptEmailSchema: RxJsonSchema<ReceiptEmail> = {
  version: 1, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    email: { type: 'string' },
    status: { type: 'string', enum: ['queued', 'sending', 'sent', 'failed'] },
    queuedAt: { type: 'string', maxLength: 32 },
    attempts: { type: 'integer', minimum: 0 },
    nextAttemptAt: { type: 'string' },
    lastAttemptAt: { type: 'string' },
    saveToBilling: { type: 'boolean' },
    sentAt: { type: 'string' }, error: { type: 'string' },
  },
  required: ['id', 'email', 'status', 'queuedAt', 'attempts'],
  indexes: ['queuedAt'],
};
export const receiptEmailMigrationStrategies = { 1: (doc: any) => ({ ...doc, attempts: 0 }) };

/** zod 4's `z.string().email()` pattern (zod/v4/core/regexes `email`): v2 receipt/email.tsx validates the address with it. */
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
/** zod 4's English message for that check, the copy v2's dialog shows under the field. */
export const INVALID_EMAIL_MESSAGE = 'Invalid email address';
/** v2's email rule on the trimmed value: one @, a local part, a dotted domain, no spaces. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export async function queueReceiptEmail(collection: ReceiptEmailCollection, orderId: string, email: string, now = new Date(),
  options: { saveToBilling?: boolean } = {}) {
  const trimmed = email.trim();
  if (!isValidEmail(trimmed)) throw new Error(INVALID_EMAIL_MESSAGE);
  return collection.upsert({ id: orderId, email: trimmed, status: 'queued', queuedAt: now.toISOString(), attempts: 0,
    saveToBilling: options.saveToBilling === true });
}

export function useReceiptEmailSender({ collection, mailer, orders, now = defaultNow, sleep = defaultSleep }: {
  collection: ReceiptEmailCollection | null; mailer: ReceiptMailer | null; orders: RxCollection<PosOrder> | null;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}) {
  useEffect(() => {
    if (!collection || !mailer || !orders) return;
    let stopped = false, ready = false, running = false, pending = false;
    async function tick() {
      if (stopped || !ready) return;
      if (running) { pending = true; return; }
      running = true;
      let transportDown = false;
      let posted = 0;
      try {
        const docs = await collection!.find({ selector: { status: 'queued' }, sort: [{ queuedAt: 'asc' }] }).exec();
        for (const doc of docs) {
          if (stopped) return;
          const order = await orders!.findOne(doc.id).exec();
          const orderId = order?.serverRefs?.orderId;
          if (!orderId || stopped || navigator.onLine === false) continue;
          const next = doc.getLatest().nextAttemptAt;
          if (next && Date.parse(next) > now()) continue;
          if (posted > 0) await sleep(SEND_SPACING_MS);
          if (stopped) return;
          const current = doc.getLatest();
          if (current.deleted || current.status !== 'queued') continue;
          const claimed = claims(collection!);
          if (claimed.has(current.id)) continue;
          claimed.add(current.id);
          posted += 1;
          try {
            await current.incrementalPatch({ status: 'sending' });
            const attempts = current.attempts + 1;
            const attemptedAt = new Date(now()).toISOString();
            let failure: EmailSendFailure | undefined;
            try { await mailer!.send(orderId, current.email, current.saveToBilling ? { saveToBilling: true } : undefined); } catch (cause) { failure = classifyEmailSendError(cause); }
            if (!failure) {
              await current.incrementalPatch({ status: 'sent', attempts, lastAttemptAt: attemptedAt, sentAt: attemptedAt, error: '' });
            } else if (failure.kind === 'permanent' || attempts >= MAX_SEND_ATTEMPTS) {
              await current.incrementalPatch({ status: 'failed', attempts, lastAttemptAt: attemptedAt,
                error: failure.kind === 'permanent' ? failure.reason : `${failure.reason} (gave up after ${attempts} tries)` });
            } else {
              await current.incrementalPatch({ status: 'queued', attempts, lastAttemptAt: attemptedAt,
                nextAttemptAt: new Date(now() + backoffMs(attempts)).toISOString(), error: failure.reason });
              transportDown = true;
              break;
            }
          } finally { claimed.delete(current.id); }
        }
      } finally {
        running = false;
        if (pending) { pending = false; if (!transportDown) void tick(); }
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
        // Decide on the latest revision inside the write queue: the send may have
        // finished, or still be claimed by an earlier mount, since the query ran.
        // v2 is at-least-once; a send cut off by a reload is posted again.
        await doc.incrementalModify(latest =>
          latest.status === 'sending' && !claims(collection).has(latest.id) ? { ...latest, status: 'queued' } : latest);
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
  }, [collection, mailer, orders, now, sleep]);
}
