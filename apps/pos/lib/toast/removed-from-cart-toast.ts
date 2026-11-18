import type { useSale } from '@tallyui/pos';
import { toast } from './toast';

type Sale = ReturnType<typeof useSale>;
const nameOf = (lines: readonly { id: string; name: string }[] | undefined, id: string) => lines?.find(line => line.id === id)?.name;
const removed = (name: string | undefined) => { if (name) toast({ type: 'success', title: `${name} removed from cart` }); };

// v2 use-remove-line-item.ts:138-160 and use-remove-coupon.ts:67-73; v2's Undo is left out: the sale API has no restore.
// Each name is read before the removal, as v2 does (use-remove-line-item.ts:102).
export function withRemovedToasts(sale: Sale): Pick<Sale, 'remove' | 'removeFee' | 'removeShipping' | 'removeDiscount'> {
  return {
    remove: id => { const name = nameOf(sale.order.lineItems, id); sale.remove(id); removed(name); },
    removeFee: id => { const name = nameOf(sale.order.fees, id); const refused = sale.removeFee(id); if (refused === null) removed(name); return refused; },
    removeShipping: id => { const name = nameOf(sale.order.shipping, id); const refused = sale.removeShipping(id); if (refused === null) removed(name); return refused; },
    removeDiscount: id => { sale.removeDiscount(id); toast({ type: 'info', title: 'Discount removed' }); },
  };
}
