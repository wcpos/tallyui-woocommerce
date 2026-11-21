import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ServerCapabilities } from '@tallyui/core';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries, SALE_SAVING, TaxProvider, useSale } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { CartWithSettings } from '../components/cart-settings';
import { withRemovedToasts } from '../lib/toast/removed-from-cart-toast';
import { dismissToast, getToasts } from '../lib/toast/toast';
import products from './fixtures/products.json';
import { memoryStorage } from './memory-storage';

vi.mock('../lib/register/register-context', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/register/register-context')>(),
  useRegister: () => null,
}));

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const connector = createWooCommerceConnector();
const product = products[0];
const capabilities: ServerCapabilities = { orderCreate: 6, coupons: false, multiplePayments: false };
let latest: ReturnType<typeof useSale>;

function Harness() {
  const sale = useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2', capabilities });
  latest = sale;
  return <CartWithSettings sale={sale} position="left" onPositionChange={() => {}} />;
}

function renderCart() {
  return render(<><TaxProvider ratesPpm={{}} pricesIncludeTax={false}><Harness /></TaxProvider><PortalHost /></>);
}

function addProduct() {
  act(() => latest.add(catalogueEntries([product], connector.traits.product, { currency: 'USD' })[0], connector.traits.product));
}

test('removing a product line toasts "<name> removed from cart" as success', () => {
  renderCart();
  addProduct();
  fireEvent.click(screen.getByRole('button', { name: `Remove ${product.name}` }));
  expect(getToasts()).toContainEqual(expect.objectContaining({ type: 'success', title: `${product.name} removed from cart` }));
  expect(latest.order.lineItems).toHaveLength(0);
});

test('removing a fee toasts its name removed from cart', () => {
  renderCart();
  act(() => { latest.addFee({ name: 'Bag', amountMinor: 20 }); });
  fireEvent.click(screen.getByRole('button', { name: 'Edit total of Bag' })); // 4.0.0: the Total opens the line strip
  fireEvent.click(screen.getByRole('button', { name: 'Remove Bag' }));
  expect(getToasts()).toContainEqual(expect.objectContaining({ type: 'success', title: 'Bag removed from cart' }));
  expect(latest.order.fees ?? []).toHaveLength(0);
});

test('removing a shipping line toasts its name removed from cart', () => {
  renderCart();
  act(() => { latest.addShipping({ name: 'Flat rate', amountMinor: 500 }); });
  fireEvent.click(screen.getByRole('button', { name: 'Edit total of Flat rate' })); // 4.0.0: the Total opens the line strip
  fireEvent.click(screen.getByRole('button', { name: 'Remove Flat rate' }));
  expect(getToasts()).toContainEqual(expect.objectContaining({ type: 'success', title: 'Flat rate removed from cart' }));
  expect(latest.order.shipping ?? []).toHaveLength(0);
});

test('removing a discount toasts "Discount removed" as info', () => {
  renderCart();
  addProduct();
  act(() => { latest.applyDiscount(null, { type: 'percentage', value: 10 }); });
  fireEvent.click(screen.getByRole('button', { name: /^Remove discount/ }));
  expect(getToasts()).toEqual([expect.objectContaining({ type: 'info', title: 'Discount removed' })]);
  expect(getToasts().some(item => item.title.endsWith('removed from cart'))).toBe(false);
  expect(latest.order.discounts).toHaveLength(0);
});

test('starting a new sale or closing the sale does not toast a removal', () => {
  renderCart();
  addProduct();
  act(() => {
    latest.addFee({ name: 'Bag', amountMinor: 20 });
    latest.applyDiscount(null, { type: 'percentage', value: 10 });
  });
  act(() => latest.newSale());
  expect(getToasts().some(item => item.title.endsWith('removed from cart') || item.title === 'Discount removed')).toBe(false);
  addProduct();
  act(() => { latest.closeSale(); });
  expect(getToasts().some(item => item.title.endsWith('removed from cart') || item.title === 'Discount removed')).toBe(false);
});

test('each name is read before the line is removed', () => {
  const order = {
    lineItems: [{ id: 'l1', name: 'Blue Shirt' }],
    fees: [{ id: 'f1', name: 'Bag' }],
    shipping: [{ id: 's1', name: 'Flat rate' }],
  };
  const sale = {
    order,
    remove(id: string) { order.lineItems = order.lineItems.filter(line => line.id !== id); },
    removeFee(id: string) { order.fees = order.fees.filter(line => line.id !== id); return null; },
    removeShipping(id: string) { order.shipping = order.shipping.filter(line => line.id !== id); return null; },
    removeDiscount() {},
  } as unknown as Parameters<typeof withRemovedToasts>[0];
  const wrapped = withRemovedToasts(sale);
  wrapped.remove('l1');
  wrapped.removeFee('f1');
  wrapped.removeShipping('s1');
  const titles = getToasts().map(item => item.title);
  expect([...titles].sort()).toEqual([
    'Blue Shirt removed from cart',
    'Bag removed from cart',
    'Flat rate removed from cart',
  ].sort());
  expect(order.lineItems).toEqual([]);
  expect(order.fees).toEqual([]);
  expect(order.shipping).toEqual([]);
});

// The refusal is whatever the real useSale().removeFee / removeShipping returns besides null.
function refusingSale(refusal: ReturnType<ReturnType<typeof useSale>['removeFee']>) {
  const order = { lineItems: [], fees: [{ id: 'f1', name: 'Bag' }], shipping: [{ id: 's1', name: 'Flat rate' }] };
  const sale = { order, remove() {}, removeFee: () => refusal, removeShipping: () => refusal, removeDiscount() {} };
  return { order, wrapped: withRemovedToasts(sale as unknown as Parameters<typeof withRemovedToasts>[0]) };
}

test('a refused fee removal returns the refusal, shows no toast and leaves the fee', () => {
  const { order, wrapped } = refusingSale(SALE_SAVING);
  expect(wrapped.removeFee('f1')).toBe(SALE_SAVING);
  expect(getToasts()).toEqual([]);
  expect(order.fees).toEqual([{ id: 'f1', name: 'Bag' }]);
});

test('a refused shipping removal returns the refusal, shows no toast and leaves the line', () => {
  const { order, wrapped } = refusingSale(SALE_SAVING);
  expect(wrapped.removeShipping('s1')).toBe(SALE_SAVING);
  expect(getToasts()).toEqual([]);
  expect(order.shipping).toEqual([{ id: 's1', name: 'Flat rate' }]);
});
