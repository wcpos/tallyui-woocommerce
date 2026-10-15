import { expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreOrder, SyncContext, TallyConnector } from '@tallyui/core';
import { orderHistorySource, toHistoryRow } from '../lib/orders/order-history';

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
