import { useEffect, useRef, useState } from 'react';
import { AFTER_CLOSE_PAYMENTS_CHANGED, cashVoidRefusal, legStatus, SALE_FINISHED } from '@tallyui/pos';
import type { Payment, TenderVoid, useSale } from '@tallyui/pos';
import { recordTenderVoids, type TenderVoidCollection } from './tender-voids';
import { REGISTER_ID } from '../register/register-id';

/** A journalled void that the sale subsequently refused. */
export const VOID_RECORDED_KEPT = 'The void was recorded, but the sale kept the payment. Check the payments before you finish the sale.';

/** The refusal voidTender or removeTender would give this leg now, read from the sale's state; undefined when neither would refuse for these reasons. */
function legRefusal(sale: ReturnType<typeof useSale>, payment: Payment): string | undefined {
  if (sale.stage.kind === 'receipt') return SALE_FINISHED;
  if (sale.order.afterClose?.payments.some(leg => leg.id === payment.id)) return AFTER_CLOSE_PAYMENTS_CHANGED;
  if (payment.locked) return 'The store already holds this payment.';
  return undefined;
}

export interface TenderCancel {
  /** The "Cancel payments" view is open. */
  cancelling: boolean;
  /** The last void refusal or journal write failure, shown above the tender. */
  voidError: string | undefined;
  /** Cancel pressed: opens the void view when legs are taken, else cancels at once. */
  requestCancel(): void;
  /** Keep payments: closes the void view. */
  keepPayments(): void;
  /** Cancel payments: journals all live legs, then voids them latest first. A tap while one runs does nothing. */
  confirmCancel(): Promise<void>;
  /** Journals one leg, then voids it if taken or removes it if untaken. */
  removeLeg(id: string): Promise<void>;
}
export interface TenderCancelContext {
  /** Resolved inside the write's try, as before: a missing collection is a reported write failure. */
  collection(): TenderVoidCollection;
  sessionId: string | undefined;
  cashierRef: string;
}
/** The multi-payment tender's cancel-and-void flow: a leg leaves the sale only once its void is journalled. */
export function useTenderCancel(sale: ReturnType<typeof useSale>, context: TenderCancelContext): TenderCancel {
  const [cancelling, setCancelling] = useState(false);
  const [voidError, setVoidError] = useState<string>();
  const removing = useRef(new Set<string>());
  const cancelRunning = useRef(false);
  useEffect(() => {
    if (sale.stage.kind !== 'tender') { setCancelling(false); setVoidError(undefined); }
  }, [sale.stage.kind]);

  async function voidTenders(payments: readonly Payment[], reason: TenderVoid['reason']): Promise<boolean> {
    try {
      const collection = context.collection();
      await recordTenderVoids(collection, payments, {
        saleId: sale.order.id, currency: sale.order.currency, reason,
        registerId: REGISTER_ID, sessionId: context.sessionId,
        cashierRef: context.cashierRef, deviceTime: new Date().toISOString(),
        deviceTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setVoidError(undefined);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVoidError(`The void was not recorded, so the payment was kept: ${message}`);
      return false;
    }
  }

  async function removeLeg(id: string) {
    if (sale.saving) { sale.removeTender(id); return; }
    const payment = sale.order.payments.find(payment => payment.id === id);
    if (!payment || legStatus(payment) === 'voided' || removing.current.has(id)) return;
    if (payment.takenAt !== undefined && cashVoidRefusal(sale.order, id)) { sale.voidTender(id); return; }
    const reason = legRefusal(sale, payment);
    if (reason) { setVoidError(`The payment was kept: ${reason}`); return; }
    removing.current.add(id);
    try {
      if (!(await voidTenders([payment], 'removed'))) return;
      if (payment.takenAt !== undefined) {
        if (!sale.voidTender(id)) setVoidError(VOID_RECORDED_KEPT);
      } else sale.removeTender(id);
    } finally { removing.current.delete(id); }
  }

  function requestCancel() {
    if (sale.order.payments.some(p => legStatus(p) !== 'voided') && !sale.saving) setCancelling(true);
    else sale.cancelTender();
  }

  return { cancelling, voidError, requestCancel, removeLeg,
    keepPayments: () => setCancelling(false),
    confirmCancel: async () => {
      if (sale.saving) { setCancelling(false); sale.cancelTender(); return; }
      if (cancelRunning.current) return;
      cancelRunning.current = true;
      try {
      const live = sale.order.payments.filter(p => legStatus(p) !== 'voided');
      for (const leg of live) {
        const reason = legRefusal(sale, leg);
        if (reason) { setVoidError(`The payment was kept: ${reason}`); return; }
      }
      if (!(await voidTenders(live, 'cancelled'))) return;
      for (const leg of [...live].reverse()) {
        if (leg.takenAt === undefined) sale.removeTender(leg.id);
        else if (!sale.voidTender(leg.id)) { setVoidError(VOID_RECORDED_KEPT); setCancelling(false); return; }
      }
      setCancelling(false); sale.cancelTender();
      } finally { cancelRunning.current = false; }
    },
  };
}
