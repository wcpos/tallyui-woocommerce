import { getToasts, toast, TOAST_DURATION_MS } from './toast';

export const ADDED_TO_CART_TOAST_ID = 'pos-added-to-cart';
export const ADDED_TO_CART_DURATION = TOAST_DURATION_MS;
let count = 0;
let lastAddAt = 0;

// v2 pos/hooks/added-to-cart-toast.ts: count adds while the shared toast is up.
export function showAddedToCartToast(name: string): void {
  const now = Date.now();
  if (now - lastAddAt > ADDED_TO_CART_DURATION || !getToasts().some(item => item.id === ADDED_TO_CART_TOAST_ID)) {
    count = 0;
  }
  count += 1;
  lastAddAt = now;
  toast({
    id: ADDED_TO_CART_TOAST_ID, type: 'success', duration: ADDED_TO_CART_DURATION,
    title: count === 1 ? `${name} added to cart` : `${count} items added to cart`,
  });
}
