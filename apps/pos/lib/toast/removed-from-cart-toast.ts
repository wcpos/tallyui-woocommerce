import type { SaleRemoval, useSale } from '@tallyui/pos';
import { toast } from './toast';

type Sale = ReturnType<typeof useSale>;
const nameOf = (lines: readonly { id: string; name: string }[] | undefined, id: string) => lines?.find(line => line.id === id)?.name;

// v2 use-remove-line-item.ts:138-160 Undo uses useSale().removal/restore (#1095); coupons: use-remove-coupon.ts:67-73.
// Each name is read before the removal, as v2 does (use-remove-line-item.ts:102).
export function withRemovedToasts(sale: Sale): Pick<Sale, 'remove' | 'removeFee' | 'removeShipping' | 'removeDiscount'> {
  const removed = (name: string | undefined, removal?: SaleRemoval | null) => {
    if (name) toast({
      type: 'success', title: `${name} removed from cart`,
      action: removal ? { label: 'Undo', onPress: () => {
        const refused = sale.restore(removal);
        if (typeof refused === 'string') toast({ type: 'error', title: refused });
      } } : undefined,
    });
  };
  return {
    remove: id => { const name = nameOf(sale.order.lineItems, id); const removal = sale.removal('line', id); sale.remove(id); removed(name, removal); },
    removeFee: id => { const name = nameOf(sale.order.fees, id); const removal = sale.removal('fee', id); const refused = sale.removeFee(id); if (refused === null) removed(name, removal); return refused; },
    removeShipping: id => { const name = nameOf(sale.order.shipping, id); const removal = sale.removal('shipping', id); const refused = sale.removeShipping(id); if (refused === null) removed(name, removal); return refused; },
    removeDiscount: id => { sale.removeDiscount(id); toast({ type: 'info', title: 'Discount removed' }); },
  };
}
