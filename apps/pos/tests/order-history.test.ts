import { expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreOrder, SyncContext, TallyConnector } from '@tallyui/core';
import { initialOrderFilters, matchesOrderFilters, matchesOrderSearch, orderHistorySource, toHistoryRow, type SearchableOrder } from '../lib/orders/order-history';

const order: StoreOrder = {
  id: '901', reference: '901', status: 'on-hold', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [
    { id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 },
    { id: '2', name: 'Tea', quantity: 1, subtotalMinor: 300, subtotalTaxMinor: 0, totalMinor: 300, taxMinor: 0 },
  ],
  fees: [], shipping: [], coupons: [], taxLines: [], payments: [], refunds: [],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 900,
};
const context: SyncContext = { connectorId: 'woocommerce', baseUrl: 'https://shop.example', headers: {} };

test('orderHistorySource exposes fields and forwards filters without changing unfiltered queries', async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [order], hasMore: false }));
  const connector = { ...createWooCommerceConnector(), listOrders };
  const source = orderHistorySource(connector, () => context)!;
  expect(source.fields).toEqual(connector.orderFilters);
  expect(orderHistorySource({ ...connector, orderFilters: undefined }, () => context)!.fields).toEqual([]);
  await source.list(1, undefined, { cashierId: '2', createdVia: 'woocommerce-pos' });
  expect(listOrders).toHaveBeenLastCalledWith(context, { page: 1, perPage: 25, cashierId: '2', createdVia: 'woocommerce-pos' });
  for (const filters of [undefined, {}]) {
    await source.list(1, undefined, filters);
    expect(listOrders).toHaveBeenLastCalledWith(context, { page: 1, perPage: 25 });
  }
});

test('initialOrderFilters scopes only supported fields and a given cashier', () => {
  expect(initialOrderFilters(['status', 'cashierId', 'createdVia'], '2')).toEqual({ cashierId: '2', createdVia: 'woocommerce-pos' });
  expect(initialOrderFilters(['status'], '2')).toEqual({});
  expect(initialOrderFilters(['cashierId', 'createdVia'], undefined)).toEqual({ createdVia: 'woocommerce-pos' });
});

test('matchesOrderFilters judges local sales from the fields the till knows', () => {
  const local = { createdAt: '2026-10-15T00:00:00Z', customer: null };
  expect(matchesOrderFilters(local, {}, undefined, 'UTC')).toBe(true);
  expect(matchesOrderFilters(local, { cashierId: '3' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { cashierId: '2', createdVia: 'woocommerce-pos', status: 'completed' }, '2', 'UTC')).toBe(true);
  expect(matchesOrderFilters(local, { createdVia: 'checkout' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { storeId: '1' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { registerId: '1' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { paymentMethod: 'cash' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { status: 'processing' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { customerId: '0' }, '2', 'UTC')).toBe(true);
  expect(matchesOrderFilters({ ...local, customer: {} }, { customerId: '0' }, '2', 'UTC')).toBe(true);
  expect(matchesOrderFilters({ ...local, customer: { id: '7' } }, { customerId: '0' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters({ ...local, customer: { id: '7' } }, { customerId: '7' }, '2', 'UTC')).toBe(true);
  expect(matchesOrderFilters(local, { customerId: '7' }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { dateRange: { from: '2026-10-15', to: '2026-10-15' } }, '2', 'UTC')).toBe(true);
  expect(matchesOrderFilters(local, { dateRange: { from: '2026-10-16', to: '2026-10-16' } }, '2', 'UTC')).toBe(false);
  expect(matchesOrderFilters(local, { dateRange: { from: '2026-10-14', to: '2026-10-14' } }, '2', 'UTC')).toBe(false);
});

test('toHistoryRow counts items and labels Woo statuses', () => {
  expect(toHistoryRow(order)).toEqual({ id: '901', reference: '901', placedAt: order.placedAt,
    totalMinor: 900, currency: 'USD', itemCount: 3, stateLabel: 'On hold' });
  expect(toHistoryRow({ ...order, status: 'wc-custom', clientOrderId: 'till-order' }))
    .toMatchObject({ stateLabel: 'Wc-custom', clientOrderId: 'till-order' });
});

test('orderHistorySource is null without listOrders', () => {
  expect(orderHistorySource({ ...createWooCommerceConnector(), listOrders: undefined }, () => context)).toBeNull();
});

test('orderHistorySource asks for 25 a page', async () => {
  const page = { orders: [order], hasMore: false };
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => page);
  const source = orderHistorySource({ ...createWooCommerceConnector(), listOrders }, () => context)!;
  await expect(source.list(2)).resolves.toEqual(page);
  expect(listOrders).toHaveBeenCalledWith(context, { page: 2, perPage: 25 });
});

test('orderHistorySource passes a search to listOrders', async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [order], hasMore: false }));
  const source = orderHistorySource({ ...createWooCommerceConnector(), listOrders }, () => context)!;
  await source.list(1, 'ada');
  expect(listOrders).toHaveBeenLastCalledWith(context, { page: 1, perPage: 25, search: 'ada' });
  await source.list(1, '');
  expect(listOrders).toHaveBeenLastCalledWith(context, { page: 1, perPage: 25 });
});

test('matchesOrderSearch matches the id, store number, customer, line name and SKU', () => {
  const local: SearchableOrder = {
    id: 'till-0001-abcd1234', lines: [{ name: 'Flat White', sku: 'FW-1' }],
    customer: { name: 'Ada Lovelace', email: 'ada@example.com' }, serverRefs: { orderId: '305', displayId: '305' },
  };
  for (const search of ['abcd1234', '305', 'ada', 'EXAMPLE.COM', 'flat', 'fw-1', '  ']) {
    expect(matchesOrderSearch(local, search)).toBe(true);
  }
  expect(matchesOrderSearch(local, 'latte')).toBe(false);
  expect(matchesOrderSearch({ ...local, customer: null, serverRefs: undefined }, '305')).toBe(false);
});
