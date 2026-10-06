import type { ProductTraits } from '@tallyui/core';
import type { Discount, Order, useSale } from '@tallyui/pos';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import { catalogueEntries } from '@tallyui/pos';

export interface ParkedLine {
  productId: string; variantId?: string; quantity: number; name: string; discounts: Discount[];
}
export interface ParkedCart {
  id: string; parkedAt: string; lines: ParkedLine[]; orderDiscounts: Discount[]; itemCount: number; totalMinor: number;
  customer?: { id: string; name: string; email?: string };
}

export type ParkedCartCollection = RxCollection<ParkedCart>;
export const parkedCartSchema: RxJsonSchema<ParkedCart> = {
  version: 1, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    parkedAt: { type: 'string', maxLength: 32 },
    customer: {
      type: 'object', properties: {
        id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' },
      }, required: ['id', 'name'], additionalProperties: false,
    },
    lines: { type: 'array', items: {
      type: 'object', properties: {
        productId: { type: 'string' }, variantId: { type: 'string' },
        quantity: { type: 'number' }, name: { type: 'string' },
        discounts: { type: 'array', items: {
          type: 'object', properties: {
            type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
            label: { type: 'string' }, couponCode: { type: 'string' },
          }, required: ['type', 'value'],
        } },
      }, required: ['productId', 'quantity', 'name', 'discounts'],
    } },
    orderDiscounts: { type: 'array', items: {
      type: 'object', properties: {
        type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
        label: { type: 'string' }, couponCode: { type: 'string' },
      }, required: ['type', 'value'],
    } },
    itemCount: { type: 'integer' }, totalMinor: { type: 'integer' },
  },
  required: ['id', 'parkedAt', 'lines', 'orderDiscounts', 'itemCount', 'totalMinor'],
  indexes: ['parkedAt'],
};

// v0 carts have no customer, and they restore as guest carts.
export const parkedCartMigrationStrategies = { 1: (doc: any) => doc };

function discountFields({ type, value, label, couponCode }: Discount): Discount {
  return { type, value, ...(label !== undefined ? { label } : {}), ...(couponCode !== undefined ? { couponCode } : {}) };
}

export function parkCart(order: Order, now = new Date()): ParkedCart {
  return {
    id: crypto.randomUUID(), parkedAt: now.toISOString(),
    ...(order.customer ? { customer: {
      id: order.customer.id, name: order.customer.name,
      ...(order.customer.email ? { email: order.customer.email } : {}),
    } } : {}),
    lines: order.lineItems.map(({ productId, variantId, quantity, name, discounts }) => ({
      productId, variantId, quantity, name, discounts: discounts.map(discountFields),
    })),
    orderDiscounts: order.discounts.map(discountFields),
    itemCount: order.lineItems.reduce((count, line) => count + line.quantity, 0),
    totalMinor: order.totalMinor,
  };
}

type RestoreSale = Pick<ReturnType<typeof useSale>, 'add' | 'setQuantity' | 'applyDiscount' | 'order' | 'setCustomer'>;

// Start with an empty sale; after each yield, pass the sale from the next order render to next(sale).
export function* restoreCart(
  sale: RestoreSale, parked: ParkedCart, products: any[], traits: ProductTraits<any>, currency: string,
): Generator<void, string[], RestoreSale> {
  const problems: string[] = [];
  sale.setCustomer(parked.customer ?? null);
  for (const line of parked.lines) {
    const product = products.find(doc => traits.getId(doc) === line.productId);
    if (!product) {
      problems.push(`${line.name} is no longer in the catalogue.`);
      continue;
    }
    const entry = catalogueEntries([product], traits, { currency }).find(entry => entry.variant.id === line.variantId);
    if (!entry) {
      problems.push(`${line.name} is no longer available.`);
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
