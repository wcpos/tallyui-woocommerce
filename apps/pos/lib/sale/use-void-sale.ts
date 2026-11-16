import { useRef } from 'react';
import type { useSale } from '@tallyui/pos';
import { parkCart, type ParkedCart } from './parked-carts';
import { toast } from '../toast/toast';

export interface VoidSale {
  /** Void is offered while the cart has lines and no payment. */
  offered: boolean;
  /** Clears the cart at once and offers Undo, as v2's use-void-order.ts. */
  voidSale(): void;
}

/** v2 voids at once and offers Undo (pos/hooks/use-void-order.ts): Undo brings the voided cart back as resumeCart does. */
export function useVoidSale(sale: ReturnType<typeof useSale>, context: { resumeCart(cart: ParkedCart): Promise<string | null>; say(message: string | undefined): void }): VoidSale {
  const stageNow = useRef(sale.stage);
  stageNow.current = sale.stage;

  function voidSale() {
    const voided = parkCart(sale.order);
    sale.newSale();
    toast({ type: 'success', title: 'Order removed', action: { label: 'Undo', onPress: () => { void undoVoid(voided); } } });
  }

  async function undoVoid(cart: ParkedCart) {
    if (stageNow.current.kind !== 'cart') {
      context.say('Finish the current sale first, then undo the void.');
      return;
    }
    const result = await context.resumeCart(cart);
    if (typeof result === 'string') context.say(result);
  }

  return { offered: sale.order.lineItems.length > 0 && sale.order.payments.length === 0, voidSale };
}
