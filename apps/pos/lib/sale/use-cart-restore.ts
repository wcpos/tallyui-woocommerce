import { useEffect, useRef, useState } from 'react';
import type { ProductTraits } from '@tallyui/core';
import type { useSale } from '@tallyui/pos';
import { restoreCart, type ParkedCart } from './parked-carts';
export interface CartRestore {
  /** The parked cart being restored, until its last line and coupon are back. */
  restoring: ParkedCart | undefined;
  /** Clears the sale and restores `cart` into it; resolves null once done. */
  restore(cart: ParkedCart): Promise<null>;
}
/** Restores a parked cart one step per sale order render. */
export function useCartRestore(sale: ReturnType<typeof useSale>, products: any[], traits: ProductTraits<any>, currency: string, onDone: (message: string | undefined) => void): CartRestore {
  const [restoring, setRestoring] = useState<ParkedCart>();
  const restoreSteps = useRef<ReturnType<typeof restoreCart> | null>(null);
  const restoreResolve = useRef<((result: null) => void) | null>(null);
  useEffect(() => {
    if (!restoring) return;
    restoreSteps.current ??= restoreCart(sale, restoring, products, traits, currency);
    const step = restoreSteps.current.next(sale);
    if (step.done) {
      restoreSteps.current = null;
      setRestoring(undefined);
      const problems = step.value;
      const resolve = restoreResolve.current;
      restoreResolve.current = null;
      void (async () => {
        for (const code of restoring.coupons ?? []) {
          const refusal = await sale.applyCoupon(code);
          if (refusal !== null) problems.push(`Coupon ${code} was removed: ${refusal}.`);
        }
        onDone(problems.join(' ') || undefined);
        resolve?.(null);
      })();
    }
  }, [sale.order, restoring]);
  return { restoring, restore: cart => new Promise<null>(resolve => {
    restoreResolve.current = resolve;
    sale.newSale();
    setRestoring(cart);
  }) };
}
