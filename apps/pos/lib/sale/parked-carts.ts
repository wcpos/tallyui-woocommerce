import type { ProductTraits } from '@tallyui/core';
import type { Discount, Order, useSale } from '@tallyui/pos';
import { simpleEntry } from './simple-entry';

export interface ParkedLine {
  productId: string; variantId?: string; quantity: number; name: string; discounts: Discount[];
}
export interface ParkedCart {
  id: string; parkedAt: string; lines: ParkedLine[]; orderDiscounts: Discount[]; itemCount: number; totalMinor: number;
}

function discountFields({ type, value, label, couponCode }: Discount): Discount {
  return { type, value, ...(label !== undefined ? { label } : {}), ...(couponCode !== undefined ? { couponCode } : {}) };
}

export function parkCart(order: Order, now = new Date()): ParkedCart {
  return {
    id: crypto.randomUUID(), parkedAt: now.toISOString(),
    lines: order.lineItems.map(({ productId, variantId, quantity, name, discounts }) => ({
      productId, variantId, quantity, name, discounts: discounts.map(discountFields),
    })),
    orderDiscounts: order.discounts.map(discountFields),
    itemCount: order.lineItems.reduce((count, line) => count + line.quantity, 0),
    totalMinor: order.totalMinor,
  };
}

type RestoreSale = Pick<ReturnType<typeof useSale>, 'add' | 'setQuantity' | 'applyDiscount' | 'order'>;

// Start with an empty sale; after each yield, pass the sale from the next order render to next(sale).
export function* restoreCart(
  sale: RestoreSale, parked: ParkedCart, products: any[], traits: ProductTraits<any>, currency: string,
): Generator<void, string[], RestoreSale> {
  const problems: string[] = [];
  for (const line of parked.lines) {
    const product = products.find(doc => traits.getId(doc) === line.productId);
    if (!product) {
      problems.push(`${line.name} is no longer in the catalogue.`);
      continue;
    }
    const entry = simpleEntry(product, traits, currency);
    if (!entry) {
      problems.push(`${line.name} is not a simple product.`);
      continue;
    }
    sale.add(entry, traits);
    sale = yield;
    const lineId = sale.order.lineItems.find(item => item.productId === line.productId && item.variantId === entry.variant.id)!.id;
    sale.setQuantity(lineId, line.quantity);
    for (const discount of line.discounts) {
      const refused = sale.applyDiscount(lineId, discount);
      if (refused) problems.push(`Discount for ${line.name} was refused: ${refused}.`);
    }
  }
  for (const discount of parked.orderDiscounts) {
    const refused = sale.applyDiscount(null, discount);
    if (refused) problems.push(`Order discount was refused: ${refused}.`);
  }
  return problems;
}
