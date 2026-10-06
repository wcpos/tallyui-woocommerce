import { expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { SyncContext, TallyConnector } from '@tallyui/core';
import { receiptMailer } from '../lib/receipts/receipt-mailer';

const context: SyncContext = { connectorId: 'woocommerce', baseUrl: 'https://shop.example', headers: { Authorization: 'Bearer first' } };

test('no mailer without emailReceipt, including the installed WooCommerce connector', () => {
  expect(receiptMailer({} as TallyConnector, () => context)).toBeNull();
  expect(receiptMailer(createWooCommerceConnector(), () => context)).toBeNull();
});

test('forwards the order and email with the latest context on every send', async () => {
  const emailReceipt = vi.fn(async (_context: SyncContext, _orderId: string, _email: string) => {});
  const connector = { ...createWooCommerceConnector(), emailReceipt };
  let token = 'first';
  const getContext = vi.fn(() => ({ ...context, headers: { Authorization: `Bearer ${token}` } }));
  const mailer = receiptMailer(connector, getContext)!;
  expect(getContext).not.toHaveBeenCalled();
  await expect(mailer.send('115', 'a@b.c')).resolves.toBeUndefined();
  expect(emailReceipt).toHaveBeenNthCalledWith(1, context, '115', 'a@b.c');
  token = 'second';
  await mailer.send('116', 'c@d.e');
  expect(emailReceipt).toHaveBeenNthCalledWith(2, { ...context, headers: { Authorization: 'Bearer second' } }, '116', 'c@d.e');
  expect(getContext).toHaveBeenCalledTimes(2);
});
