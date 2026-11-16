import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries, createOrderBuilder, TaxProvider, useSale } from '@tallyui/pos';
import { parkCart } from '../lib/sale/parked-carts';
import { useCartRestore } from '../lib/sale/use-cart-restore';
import products from './fixtures/products.json';

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

function setup(catalogue = products) {
  const onDone = vi.fn();
  const { result } = renderHook(() => {
    const sale = useSale({ currency: 'USD' }, {
      registerId: 'web', cashierRef: '2', capabilities: { orderCreate: 2 },
    });
    return { sale, ...useCartRestore(sale, catalogue, traits, 'USD', onDone) };
  }, {
    wrapper: ({ children }: { children: ReactNode }) => createElement(TaxProvider, {
      ratesPpm: {}, pricesIncludeTax: false, children,
    }),
  });
  return { result, onDone };
}

test('clears the sale and restores a parked cart', async () => {
  const { result, onDone } = setup();
  const unrelated = catalogueEntries([{ ...products[0], id: 999 }], traits, { currency: 'USD' })[0];
  act(() => result.current.sale.add(unrelated, traits));
  let pending!: Promise<null>;
  act(() => { pending = result.current.restore(parkCart(orderFixture())); });
  await act(async () => { expect(await pending).toBeNull(); });
  expect(result.current.sale.order.lineItems.map(line => line.productId)).toEqual(['80', '84']);
  expect(result.current.sale.order.lineItems.map(line => line.quantity)).toEqual([2, 1]);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledWith(undefined);
  expect(result.current.restoring).toBeUndefined();
});

test('reports a missing product and restores the available line', async () => {
  const { result, onDone } = setup([products[1]]);
  let pending!: Promise<null>;
  act(() => { pending = result.current.restore(parkCart(orderFixture())); });
  await act(async () => { expect(await pending).toBeNull(); });
  expect(onDone).toHaveBeenCalledWith('Espresso is no longer in the catalogue.');
  expect(result.current.sale.order.lineItems.map(line => line.productId)).toEqual(['84']);
  expect(result.current.restoring).toBeUndefined();
});

test('settles an empty cart restore and clears restoring', async () => {
  const { result, onDone } = setup();
  const empty = { id: 'empty', parkedAt: new Date().toISOString(), lines: [], orderDiscounts: [], itemCount: 0, totalMinor: 0 };
  let pending!: Promise<null>;
  act(() => { pending = result.current.restore(empty); });
  await act(async () => { expect(await pending).toBeNull(); });
  expect(result.current.restoring).toBeUndefined();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledWith(undefined);
});
