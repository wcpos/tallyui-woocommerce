import type { ProductTraits } from '@tallyui/core';
import type { Discount, Order, useSale } from '@tallyui/pos';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import { catalogueEntries } from '@tallyui/pos';

export interface ParkedLine {
  productId: string; variantId?: string; quantity: number; name: string; discounts: Discount[];
  custom?: { priceMinor: number; sku?: string; taxClass?: string; taxStatus: 'taxable' | 'none' };
}
export interface ParkedCharge {
  name: string; amountMinor: number; taxStatus: 'taxable' | 'none'; taxClass?: string;
}
export interface ParkedCart {
  id: string; parkedAt: string; lines: ParkedLine[]; orderDiscounts: Discount[]; itemCount: number; totalMinor: number;
  customer?: { id: string; name: string; email?: string };
  fees?: ParkedCharge[]; shipping?: Array<ParkedCharge & { methodId?: string }>;
}

export type ParkedCartCollection = RxCollection<ParkedCart>;
export const parkedCartSchema: RxJsonSchema<ParkedCart> = {
  version: 2, primaryKey: 'id', type: 'object',
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
        custom: { type: 'object', properties: {
          priceMinor: { type: 'integer' }, sku: { type: 'string' }, taxClass: { type: 'string' },
          taxStatus: { type: 'string', enum: ['taxable', 'none'] },
        }, required: ['priceMinor', 'taxStatus'], additionalProperties: false },
        discounts: { type: 'array', items: {
          type: 'object', properties: {
            type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
            label: { type: 'string' }, couponCode: { type: 'string' },
          }, required: ['type', 'value'],
        } },
      }, required: ['productId', 'quantity', 'name', 'discounts'],
    } },
    fees: { type: 'array', items: {
      type: 'object', properties: {
        name: { type: 'string' }, amountMinor: { type: 'integer' }, taxClass: { type: 'string' },
        taxStatus: { type: 'string', enum: ['taxable', 'none'] },
      }, required: ['name', 'amountMinor', 'taxStatus'],
    } },
    shipping: { type: 'array', items: {
      type: 'object', properties: {
        name: { type: 'string' }, amountMinor: { type: 'integer' }, taxClass: { type: 'string' }, methodId: { type: 'string' },
        taxStatus: { type: 'string', enum: ['taxable', 'none'] },
      }, required: ['name', 'amountMinor', 'taxStatus'],
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
// v1 carts have no charges or custom lines.
export const parkedCartMigrationStrategies = { 1: (doc: any) => doc, 2: (doc: any) => doc };

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
    lines: order.lineItems.map(({ productId, variantId, quantity, name, discounts, custom, unitPriceMinor, sku, taxClass, taxStatus }) => ({
      productId, ...(custom ? { custom: {
        priceMinor: unitPriceMinor, taxStatus: taxStatus ?? 'taxable',
        ...(sku ? { sku } : {}), ...(taxClass !== undefined ? { taxClass } : {}),
      } } : { variantId }), quantity, name, discounts: discounts.map(discountFields),
    })),
    ...(order.fees?.length ? { fees: order.fees.map(({ name, amountMinor, taxStatus, taxClass }) => ({
      name, amountMinor, taxStatus, ...(taxClass !== undefined ? { taxClass } : {}),
    })) } : {}),
    ...(order.shipping?.length ? { shipping: order.shipping.map(({ name, amountMinor, taxStatus, taxClass, methodId }) => ({
      name, amountMinor, taxStatus, ...(taxClass !== undefined ? { taxClass } : {}), ...(methodId !== undefined ? { methodId } : {}),
    })) } : {}),
    orderDiscounts: order.discounts.map(discountFields),
    itemCount: order.lineItems.reduce((count, line) => count + line.quantity, 0),
    totalMinor: order.totalMinor,
  };
}

type RestoreSale = Pick<ReturnType<typeof useSale>, 'add' | 'addCustomLine' | 'addFee' | 'addShipping' | 'setQuantity' | 'applyDiscount' | 'order' | 'setCustomer'>;

// Start with an empty sale; after each yield, pass the sale from the next order render to next(sale).
export function* restoreCart(
  sale: RestoreSale, parked: ParkedCart, products: any[], traits: ProductTraits<any>, currency: string,
): Generator<void, string[], RestoreSale> {
  const problems: string[] = [];
  sale.setCustomer(parked.customer ?? null);
  for (const line of parked.lines) {
    if (line.custom) {
      const added = sale.addCustomLine({ name: line.name, quantity: line.quantity, ...line.custom });
      if (typeof added === 'string') { problems.push(`${line.name} was refused: ${added}.`); continue; }
      sale = yield;
      for (const discount of line.discounts) {
        const refused = sale.applyDiscount(added.id, discount);
        if (refused) problems.push(`Discount for ${line.name} was refused: ${refused}.`);
      }
      continue;
    }
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
  for (const charge of parked.fees ?? []) {
    const refused = sale.addFee(charge);
    if (typeof refused === 'string') problems.push(`${charge.name} was refused: ${refused}.`);
  }
  for (const charge of parked.shipping ?? []) {
    const refused = sale.addShipping(charge);
    if (typeof refused === 'string') problems.push(`${charge.name} was refused: ${refused}.`);
  }
  for (const discount of parked.orderDiscounts) {
    const refused = sale.applyDiscount(null, discount);
    if (refused) problems.push(`Order discount was refused: ${refused}.`);
  }
  return problems;
}
