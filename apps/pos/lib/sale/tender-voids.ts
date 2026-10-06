import type { Payment, TenderVoid } from '@tallyui/pos';
import type { RxCollection } from 'rxdb';

export type TenderVoidCollection = RxCollection<TenderVoid>;
export const TENDER_VOID_WRITE_ONCE = 'tender_void_write_once';

/** Installs hooks that reject changes to recorded voids. */
export function guardTenderVoids(collection: TenderVoidCollection): void {
  collection.preSave(() => { throw new Error(TENDER_VOID_WRITE_ONCE); }, false);
  collection.preRemove(() => { throw new Error(TENDER_VOID_WRITE_ONCE); }, false);
}

export interface TenderVoidContext {
  saleId: string; currency: string; reason: TenderVoid['reason'];
  registerId: string; sessionId?: string; cashierRef: string;
  deviceTime: string; deviceTz: string;
}

/** Inserts each void once; an already recorded payment keeps its original row. */
export async function recordTenderVoids(
  collection: TenderVoidCollection, payments: readonly Payment[], context: TenderVoidContext,
): Promise<void> {
  const { saleId, currency, reason, registerId, sessionId, cashierRef, deviceTime, deviceTz } = context;
  const rows: TenderVoid[] = payments.map(payment => ({
    paymentId: payment.id, saleId, type: 'void', method: payment.method as TenderVoid['method'],
    amountMinor: payment.amountMinor, currency, reason, deviceTime, deviceTz, registerId, cashierRef,
    ...(payment.tenderedMinor !== undefined ? { tenderedMinor: payment.tenderedMinor } : {}),
    ...(payment.reference !== undefined ? { reference: payment.reference } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  }));
  const result = await collection.bulkInsert(rows);
  const failure = result.error.find(error => error.status !== 409);
  if (failure) throw new Error(`Tender void ${failure.documentId} failed with status ${failure.status}`);
}
