import { useEffect, useRef } from 'react';
import type { ParkedOrderSummary, useSale } from '@tallyui/pos';
import { parkCart, type ParkedCart } from './parked-carts';
import type { ParkedCartStore } from './use-parked-carts';
import type { CartRestore } from './use-cart-restore';

export interface ParkAndResume {
  /** The parked carts as the Parked sales list shows them. */
  summaries: ParkedOrderSummary[];
  /** Parks the open cart and starts a new sale; resolves null, or the failure message. */
  park(): Promise<string | null>;
  /** Resumes the parked cart with this id once the catalogue is ready; resolves null, or the message. */
  resume(id: string): Promise<string | null>;
  /** Takes `cart` out of the parked list, parking a non-empty open cart in its place, and restores it. */
  resumeCart(cart: ParkedCart): Promise<string | null>;
  /** Parks a non-empty open cart and records it under heldCartKey so it comes back after a redirect.
   *  Resolves the parked cart, undefined for an empty cart, or the failure message. */
  hold(): Promise<ParkedCart | undefined | string>;
  /** Forgets the heldCartKey record and resumes `held` at once (a cashier switch that failed). */
  unhold(held: ParkedCart): Promise<string | null>;
  /** Deletes a parked cart; a failure is said, not thrown. */
  discard(id: string): Promise<void>;
}
export interface ParkAndResumeContext {
  store: ParkedCartStore;
  cartRestore: CartRestore;
  /** Where a held cart's id is kept across a redirect; undefined turns holding-for-later off. */
  heldCartKey: string | undefined;
  /** props.status === 'ready': the catalogue has synced. */
  catalogueReady: boolean;
  say(message: string | undefined): void;
}
/** Parking, resuming and holding the open cart. */
export function useParkAndResume(sale: ReturnType<typeof useSale>, context: ParkAndResumeContext): ParkAndResume {
  const currentOrder = useRef<typeof sale.order | null>(sale.order);
  currentOrder.current = sale.order;
  const heldAtMount = useRef<string | null>(null);
  useEffect(() => {
    try { heldAtMount.current = context.heldCartKey ? localStorage.getItem(context.heldCartKey) : null; } catch {}
  }, []);
  const summaries: ParkedOrderSummary[] = context.store.parked.map(cart => ({
    id: cart.id, customerName: cart.customer?.name, itemCount: cart.itemCount,
    totalMinor: cart.totalMinor, parkedAt: cart.parkedAt, source: 'local',
  }));

  async function park() {
    const cart = parkCart(sale.order);
    try {
      await context.store.park(cart);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    sale.newSale();
    return null;
  }

  async function resume(id: string) {
    // The 3.3.0 product schema v2 resyncs the catalogue once; resuming before it finishes would drop lines.
    if (!context.catalogueReady) {
      return 'The catalogue is still syncing. Try again in a moment.';
    }
    return resumeCart(context.store.parked.find(cart => cart.id === id)!);
  }

  async function resumeCart(selected: ParkedCart): Promise<string | null> {
    const { id } = selected;
    const current = currentOrder.current?.lineItems.length ? parkCart(currentOrder.current) : undefined;
    try {
      await context.store.swap(id, current);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return context.cartRestore.restore(selected);
  }

  // Parks a non-empty cart and records it under heldCartKey so it comes back after a redirect.
  // Resolves the parked cart, undefined for an empty cart, or the failure message.
  async function hold(): Promise<ParkedCart | undefined | string> {
    // Only an open cart is parked: on the receipt stage the builder still holds the finished sale, which must never come back.
    if (sale.stage.kind !== 'cart' || !sale.order.lineItems.length) return undefined;
    const held = parkCart(sale.order);
    try {
      await context.store.park(held);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    try { if (context.heldCartKey) localStorage.setItem(context.heldCartKey, held.id); } catch {}
    sale.newSale();
    currentOrder.current = null;
    return held;
  }

  useEffect(() => {
    if (!context.heldCartKey || !heldAtMount.current || !context.catalogueReady
      || sale.stage.kind !== 'cart' || sale.order.lineItems.length || context.cartRestore.restoring) return;
    const cart = context.store.parked.find(cart => cart.id === heldAtMount.current);
    if (!cart) return;
    heldAtMount.current = null;
    try { localStorage.removeItem(context.heldCartKey); } catch {}
    void resumeCart(cart).then(error => { if (typeof error === 'string') context.say(error); });
  }, [context.store.parked, context.catalogueReady, sale.stage.kind, sale.order.lineItems.length, context.cartRestore.restoring]);

  async function discard(id: string) {
    try {
      await context.store.discard(id);
    } catch (error) {
      context.say(error instanceof Error ? error.message : String(error));
    }
  }

  async function unhold(held: ParkedCart) {
    try { if (context.heldCartKey) localStorage.removeItem(context.heldCartKey); } catch {}
    return resumeCart(held);
  }

  return { summaries, park, resume, resumeCart, hold, unhold, discard };
}
