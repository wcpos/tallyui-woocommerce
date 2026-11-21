import { useEffect } from 'react';
import { RegisterSessionRequiredError, type useSale } from '@tallyui/pos';
import type { useRegister } from '../register/register-context';
import { cartLogger } from './cart-log';

export interface TenderStartContext {
  register: ReturnType<typeof useRegister> | undefined;
  /** The store takes several payments per order and the outbox is on: the tender opens with no leg preset. */
  multiPayment: boolean;
  say(message: string | undefined): void;
}

/** Opens the tender: behind the register's sale session when sessions are on, and tells the register a payment is in progress. */
export function useTenderStart(sale: ReturnType<typeof useSale>, context: TenderStartContext): (method: 'cash' | 'external') => Promise<void> {
  const { register } = context;
  useEffect(() => {
    register?.setTenderInProgress(sale.stage.kind === 'tender');
  }, [register?.setTenderInProgress, sale.stage.kind]);

  // A multi-payment tender is taken leg by leg: v2's checkout opens on the balance due with no leg taken, whatever the
  // method, so startTender's preset tender is cleared on that path (Card's is a full-total leg).
  function beginTender(method: 'cash' | 'external', options?: Parameters<typeof sale.startTender>[1]) {
    sale.startTender(method, options);
    // v2 pay.tsx:177 logs the checkout start with the order total and line count.
    cartLogger.info('Checkout started', { total: sale.order.totalMinor, lineItemCount: sale.order.lineItems.length });
    if (context.multiPayment) sale.setTender(null);
  }

  async function gatedStartTender(method: 'cash' | 'external') {
    if (!register?.enabled) { register?.setTenderInProgress(true); return beginTender(method); }
    try {
      const session = await register.requireSaleSession();
      register?.setTenderInProgress(true);
      beginTender(method, { session: session ?? undefined });
    } catch (error) {
      if (!(error instanceof RegisterSessionRequiredError)) throw error;
      context.say('Open the register to take payment.');
    }
  }

  return gatedStartTender;
}
