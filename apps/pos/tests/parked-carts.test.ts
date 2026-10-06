import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createOrderBuilder, TaxProvider, useSale } from '@tallyui/pos';
import { parkCart, restoreCart } from '../lib/sale/parked-carts';
import type { ParkedCart } from '../lib/sale/parked-carts';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const traits = createWooCommerceConnector().traits.product;
const lineDiscount = { type: 'fixed' as const, value: 50, label: 'Staff', couponCode: 'STAFF' };
const orderDiscount = { type: 'percentage' as const, value: 10, label: 'Ten percent' };

afterEach(cleanup);

function orderFixture(withOrderDiscount = false) {
  const builder = createOrderBuilder({
    currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
  });
  const espresso = builder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  builder.addLine({
    productId: '84', variantId: '84', name: 'Cold Brew', quantity: 1, unitPrice: { amount: 400, currency: 'USD' },
  });
  builder.applyLineDiscount(espresso, lineDiscount);
  if (withOrderDiscount) builder.applyOrderDiscount(orderDiscount);
  return builder.getSnapshot();
}

function restore(parked: ParkedCart, catalogue = products, orderCreate: 1 | 2 = 2) {
  const { result } = renderHook(() => useSale({ currency: 'USD' }, {
    registerId: 'web', cashierRef: '2', capabilities: { orderCreate },
  }), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(TaxProvider, {
      ratesPpm: {}, pricesIncludeTax: false, children,
    }),
  });
  const steps = restoreCart(result.current, parked, catalogue, traits, 'USD');
  let done = false;
  let problems: string[] = [];
  while (!done) {
    act(() => {
      const step = steps.next(result.current);
      if (step.done) { done = true; problems = step.value; }
    });
  }
  return { order: result.current.order, problems };
}

test('parks a real order with quantities, totals and only Discount fields', () => {
  const order = orderFixture();
  const now = new Date('2026-10-06T10:30:00.000Z');
  const parked = parkCart(order, now);
  expect(parked.id).toMatch(/^[\da-f-]{36}$/);
  expect(parkCart(order).id).not.toBe(parked.id);
  expect(parked.parkedAt).toBe(now.toISOString());
  expect(parked.itemCount).toBe(3);
  expect(parked.totalMinor).toBe(order.totalMinor);
  expect(parked.totalMinor).toBe(950);
  expect(parked.lines).toEqual([
    { productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [lineDiscount] },
    { productId: '84', variantId: '84', name: 'Cold Brew', quantity: 1, discounts: [] },
  ]);
  expect(parked.orderDiscounts).toEqual([]);
  expect(parkCart(orderFixture(true)).orderDiscounts).toEqual([orderDiscount]);
});

test.each([false, true])('restores quantities and discounts through real useSale (order discount: %s)', withOrderDiscount => {
  const original = orderFixture(withOrderDiscount);
  const { order, problems } = restore(parkCart(original));
  expect(problems).toEqual([]);
  expect(order.subtotalMinor).toBe(original.subtotalMinor);
  expect(order.totalMinor).toBe(original.totalMinor);
  expect(order.lineItems.map(line => [line.productId, line.variantId, line.quantity])).toEqual([
    ['80', '80', 2], ['84', '84', 1],
  ]);
  expect(parkCart(order).lines).toEqual(parkCart(original).lines);
  expect(parkCart(order).orderDiscounts).toEqual(parkCart(original).orderDiscounts);
});

test('reports and skips a product missing from the catalogue', () => {
  const { order, problems } = restore(parkCart(orderFixture()), [products[1]]);
  expect(problems).toEqual(['Espresso is no longer in the catalogue.']);
  expect(order.lineItems.map(line => line.productId)).toEqual(['84']);
  expect(order.totalMinor).toBe(400);
});

test('reports and skips a product whose parked variant is no longer available', () => {
  const { order, problems } = restore(parkCart(orderFixture()), [{ ...products[0], type: 'variable' }, products[1]]);
  expect(problems).toEqual(['Espresso is no longer available.']);
  expect(order.lineItems.map(line => line.productId)).toEqual(['84']);
});

test('restores the matching synced variation with its quantity, price and discount', () => {
  const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id).map(doc => doc.payload) };
  const builder = createOrderBuilder({ currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false } });
  const lineId = builder.addLine({
    productId: '102', variantId: '106', name: 'T-Shirt · M / Black', quantity: 2, unitPrice: { amount: 2500, currency: 'USD' },
  });
  builder.applyLineDiscount(lineId, lineDiscount);
  const parked = parkCart(builder.getSnapshot());
  const { order, problems } = restore(parked, [shirt]);
  expect(problems).toEqual([]);
  expect(order.lineItems).toHaveLength(1);
  expect(order.lineItems[0]).toMatchObject({
    productId: '102', variantId: '106', name: 'T-Shirt · M / Black', quantity: 2, unitPriceMinor: 2500,
  });
  expect(order.subtotalMinor).toBe(builder.getSnapshot().subtotalMinor);
  expect(order.totalMinor).toBe(4950);
  expect(parkCart(order).lines).toEqual(parked.lines);
  const missingShirt = { ...shirt, variation_docs: shirt.variation_docs.slice(0, 2) };
  const missing = restore(parked, [missingShirt]);
  expect(missing.problems).toEqual(['T-Shirt · M / Black is no longer available.']);
  expect(missing.order.lineItems).toEqual([]);
});

test('reports refused line and order discounts without applying them', () => {
  const parked = parkCart(orderFixture(true));
  parked.lines[0].discounts[0].value = 601;
  parked.orderDiscounts = [{ type: 'fixed', value: 1001 }];
  const { order, problems } = restore(parked);
  expect(problems).toEqual([
    'Discount for Espresso was refused: The discount is more than the line.',
    'Order discount was refused: The discount is more than the order.',
  ]);
  expect(order.totalMinor).toBe(1000);
  expect(order.lineItems[0].discounts).toEqual([]);
  expect(order.discounts).toEqual([]);
});
