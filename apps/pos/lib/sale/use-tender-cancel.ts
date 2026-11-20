import { useEffect, useState } from 'react';
import type { Payment, TenderVoid, useSale } from '@tallyui/pos';
import { recordTenderVoids, type TenderVoidCollection } from './tender-voids';
import { REGISTER_ID } from '../register/register-id';

export interface TenderCancel {
  /** The "Cancel payments" view is open. */
  cancelling: boolean;
  /** The last void write failure, shown above the tender. */
  voidError: string | undefined;
  /** Cancel pressed: opens the void view when legs are taken, else cancels at once. */
  requestCancel(): void;
  /** Keep payments: closes the void view. */
  keepPayments(): void;
  /** Cancel payments: journals every leg, then cancels the tender. */
  confirmCancel(): Promise<void>;
  /** Journals one leg's void, then removes it. */
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
    if (!payment) return;
    if (await voidTenders([payment], 'removed')) sale.removeTender(id);
  }

  function requestCancel() {
    if (sale.order.payments.length > 0 && !sale.saving) setCancelling(true);
    else sale.cancelTender();
  }

  return { cancelling, voidError, requestCancel, removeLeg,
    keepPayments: () => setCancelling(false),
    confirmCancel: async () => {
      if (sale.saving) { setCancelling(false); sale.cancelTender(); return; }
      if (!(await voidTenders(sale.order.payments, 'cancelled'))) return;
      setCancelling(false); sale.cancelTender();
    },
  };
}
