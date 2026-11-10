import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import type { RxCollection, RxDatabase, RxJsonSchema } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { OrderCreateEnvelope } from '@tallyui/core';
import { addPosOrderCollection } from '@tallyui/pos';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { ReceiptEmail } from '../components/receipt-email';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { queueReceiptEmail, receiptEmailSchema, receiptEmailMigrationStrategies, SEND_SPACING_MS, useReceiptEmailSender } from '../lib/receipts/receipt-emails';
import type { ReceiptEmail as ReceiptEmailRow, ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import type { ReceiptMailer } from '../lib/receipts/receipt-mailer';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';

function SaleScreen(props: ComponentProps<typeof SaleScreenWithoutHost>) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const email = 'gee@example.invalid';
const queuedText = 'Receipt email queued';
let db: RxDatabase;
let collection: ReceiptEmailCollection;
let orders: RxCollection<PosOrder>;
let send: ReturnType<typeof vi.fn<ReceiptMailer['send']>>;
let mailer: ReceiptMailer;
let clock: number;
const now = () => clock;
let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;

addRxPlugin(RxDBMigrationSchemaPlugin);

beforeEach(async () => {
  clock = Date.parse('2026-11-10T10:00:00.000Z');
  sleep = vi.fn(async (_ms: number) => {});
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  db = await createRxDatabase({ name: `emails_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ receipt_emails: collection } = await db.addCollections<{ receipt_emails: ReceiptEmailCollection }>({
    receipt_emails: { schema: receiptEmailSchema, migrationStrategies: receiptEmailMigrationStrategies },
  }));
  orders = await addPosOrderCollection(db);
  send = vi.fn<ReceiptMailer['send']>(async () => {});
  mailer = { send };
});

afterEach(async () => {
  cleanup();
  await db.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function order(id = 'sale', synced = false) {
  const now = new Date().toISOString();
  return orders.insert({ id, createdAt: now, updatedAt: now, currency: 'USD', pricesIncludeTax: false,
    lines: [], payments: [], customer: null, subtotalMinor: 300, discountMinor: 0, taxMinor: 0, totalMinor: 300,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: synced ? 'applied' : 'pending', ...(synced ? { serverRefs: { orderId: '115', totalMinor: 300 } } : {}) });
}
const request = () => collection.findOne('sale').exec();
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
const start = () => renderHook(() => useReceiptEmailSender({ collection, mailer, orders, now, sleep }));
async function sendFromDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Email Receipt' }));
  await vi.waitFor(() => screen.getByLabelText('Email Address'));
  fireEvent.click(screen.getByTestId('receipt-email-send'));
}

test('waits for sync, then the orders change sends once using the server order id', async () => {
  const sale = await order();
  await queueReceiptEmail(collection, 'sale', email);
  const readOrder = vi.spyOn(orders, 'findOne');
  start();
  await vi.waitFor(() => expect(readOrder).toHaveBeenCalledWith('sale'));
  await tick();
  expect(send).not.toHaveBeenCalled();
  expect((await request())?.status).toBe('queued');
  await act(async () => { await sale.incrementalPatch({ syncStatus: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } }); });
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
  expect((await request())?.sentAt).toEqual(expect.any(String));
  await tick();
  expect(send).toHaveBeenCalledTimes(1);
});

test('waits offline and sends once on the online event', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  start();
  await settle();
  await tick();
  expect(send).not.toHaveBeenCalled();
  expect((await request())?.status).toBe('queued');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  expect((await request())?.attempts).toBe(0);
  act(() => window.dispatchEvent(new Event('online')));
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
});

test('a failed send is not retried by ticks; Send again queues exactly one more attempt', async () => {
  await order('sale', true);
  send.mockRejectedValueOnce(new CustomerServiceError('invalid', 'Invalid order ID'));
  start();
  render(<><ReceiptEmail collection={collection} orderId="sale" defaultEmail={email} /><PortalHost /></>);
  await sendFromDialog();
  await vi.waitFor(() => expect(screen.getByText('The store refused the email: Invalid order ID')).not.toBeNull());
  expect((await request())?.status).toBe('failed');
  await tick();
  await tick();
  act(() => window.dispatchEvent(new Event('online')));
  await settle();
  expect(send).toHaveBeenCalledTimes(1);
  await sendFromDialog();
  await vi.waitFor(() => expect(screen.getByText('Email sent')).not.toBeNull());
  expect(send).toHaveBeenNthCalledWith(2, '115', email, undefined);
  expect(send).toHaveBeenCalledTimes(2);
  expect((await request())?.error).toBe('');
  expect((await request())?.attempts).toBe(1);
  await tick();
  expect(send).toHaveBeenCalledTimes(2);
});

test('recovers an interrupted send as queued and posts it once', async () => {
  await order('sale', true);
  await collection.insert({ id: 'sale', email, status: 'sending', queuedAt: new Date().toISOString(), attempts: 0 });
  start();
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
  expect((await request())?.attempts).toBe(1);
});

test('validates addresses and shows the refusal without queuing', async () => {
  await expect(queueReceiptEmail(collection, 'sale', 'nobody')).rejects.toThrow('Enter an email address');
  render(<><ReceiptEmail collection={collection} orderId="sale" defaultEmail="nobody" /><PortalHost /></>);
  await sendFromDialog();
  await vi.waitFor(() => expect(screen.getByText('Enter an email address')).not.toBeNull());
  expect(await request()).toBeNull();
});

test('upserts one trimmed request per order and clears error and sentAt', async () => {
  await collection.insert({ id: 'sale', email, status: 'failed', queuedAt: '2026-01-01T00:00:00.000Z',
    attempts: 3, nextAttemptAt: '2026-01-01T00:02:00.000Z', lastAttemptAt: '2026-01-01T00:01:00.000Z',
    sentAt: '2026-01-01T00:01:00.000Z', error: 'Previous error' });
  const now = new Date('2026-02-01T00:00:00.000Z');
  await queueReceiptEmail(collection, 'sale', ' a@b.c ', now);
  expect((await request())?.toJSON()).toEqual({ id: 'sale', email: 'a@b.c', status: 'queued', queuedAt: now.toISOString(), attempts: 0, saveToBilling: false });
  expect(await collection.find().exec()).toHaveLength(1);
});

test('unauthorized errors ask the cashier to sign in again', async () => {
  await order('sale', true);
  send.mockRejectedValueOnce(new ConnectorUnauthorizedError('Expired token', 401));
  await queueReceiptEmail(collection, 'sale', email);
  start();
  await vi.waitFor(async () => expect((await request())?.error).toBe('Sign in again to send the receipt'));
  expect((await request())?.status).toBe('failed');
});

test.each([
  ['invalid', 'Invalid order ID', 'The store refused the email: Invalid order ID'],
  ['server', 'Mail service failed', 'The store could not send the email (Mail service failed). Send again to retry.'],
  ['server', 'HTTP 409', 'The store could not send the email (HTTP 409). Send again to retry.'],
  ['server', 'unexpected response', 'The server did not send the email.'],
] as const)('%s errors fail once with the receipt message', async (code, message, expected) => {
  await order('sale', true);
  send.mockRejectedValueOnce(new CustomerServiceError(code, message));
  await queueReceiptEmail(collection, 'sale', email);
  start();
  await vi.waitFor(async () => expect((await request())?.status).toBe('failed'));
  expect((await request())?.error).toBe(expected);
  await tick();
  act(() => window.dispatchEvent(new Event('online')));
  await settle();
  expect((await request())?.status).toBe('failed');
  expect((await request())?.error).toBe(expected);
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
});

test('sends oldest first, persists sending before the call and stays single-flight', async () => {
  await order('sale', true);
  await order('other', true);
  await queueReceiptEmail(collection, 'sale', email, new Date('2026-02-01'));
  await queueReceiptEmail(collection, 'other', 'older@example.invalid', new Date('2026-01-01'));
  let finish!: () => void;
  const delivered = new Promise<void>(resolve => { finish = resolve; });
  send.mockImplementationOnce(async () => { await delivered; });
  start();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenNthCalledWith(1, '115', 'older@example.invalid', undefined);
  expect((await collection.findOne('other').exec())?.status).toBe('sending');
  expect((await request())?.status).toBe('queued');
  await tick();
  act(() => window.dispatchEvent(new Event('online')));
  await settle();
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenNthCalledWith(2, '115', email, undefined);
  expect(send).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledExactlyOnceWith(SEND_SPACING_MS);
});

test('a network failure stays queued, then retries after its back-off', async () => {
  send.mockRejectedValueOnce(new CustomerServiceError('network', 'Failed to fetch'));
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  start();
  await vi.waitFor(async () => expect((await request())?.attempts).toBe(1));
  expect((await request())?.toJSON()).toMatchObject({ status: 'queued', error: 'Could not reach the store',
    lastAttemptAt: new Date(clock).toISOString(), nextAttemptAt: new Date(clock + 30_000).toISOString() });
  await tick();
  expect(send).toHaveBeenCalledTimes(1);
  clock += 30_000;
  await tick();
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect((await request())?.attempts).toBe(2);
  expect((await request())?.error).toBe('');
  expect(send).toHaveBeenCalledTimes(2);
});

test('gives up after six tries on v2\'s back-off', async () => {
  send.mockRejectedValue(new CustomerServiceError('server', 'HTTP 503'));
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  start();
  for (let i = 1; i <= 5; i++) {
    await vi.waitFor(async () => expect((await request())?.toJSON()).toMatchObject({ attempts: i, status: 'queued' }));
    const nextAttemptAt = (await request())!.nextAttemptAt!;
    expect(nextAttemptAt).toBe(new Date(clock + 30_000 * 2 ** (i - 1)).toISOString());
    clock = Date.parse(nextAttemptAt);
    await tick();
  }
  await vi.waitFor(async () => expect((await request())?.toJSON()).toMatchObject({ status: 'failed', attempts: 6,
    error: 'The store could not send the email (HTTP 503) (gave up after 6 tries)' }));
  expect(send).toHaveBeenCalledTimes(6);
  clock += 900_000;
  await tick();
  expect(send).toHaveBeenCalledTimes(6);
});

test('a connectivity failure stops the pass', async () => {
  await order('other', true);
  await order('sale', true);
  await queueReceiptEmail(collection, 'other', 'older@example.invalid', new Date('2026-01-01'));
  await queueReceiptEmail(collection, 'sale', email, new Date('2026-02-01'));
  send.mockRejectedValueOnce(new CustomerServiceError('network', 'Failed to fetch'));
  start();
  await vi.waitFor(async () => expect((await collection.findOne('other').exec())?.attempts).toBe(1));
  await settle();
  expect(send).toHaveBeenCalledTimes(1);
  expect((await request())?.toJSON()).toMatchObject({ status: 'queued', attempts: 0 });
  await tick();
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenNthCalledWith(2, '115', email, undefined);
  expect((await collection.findOne('other').exec())?.toJSON()).toMatchObject({ status: 'queued', attempts: 1 });
});

test('a remounted sender leaves a send still in flight alone', async () => {
  let finish!: () => void;
  const delivered = new Promise<void>(resolve => { finish = resolve; });
  send.mockImplementationOnce(async () => { await delivered; });
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  const first = start();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect((await request())?.status).toBe('sending');
  first.unmount();
  start();
  await settle();
  await tick();
  expect((await request())?.status).toBe('sending');
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledTimes(1);
});

test('a send that finishes during mount recovery is not posted again', async () => {
  let finish!: () => void;
  const delivered = new Promise<void>(resolve => { finish = resolve; });
  send.mockImplementationOnce(async () => { await delivered; });
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  const first = start();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect((await request())?.status).toBe('sending');
  first.unmount();
  const realFind = collection.find.bind(collection);
  vi.spyOn(collection, 'find').mockImplementationOnce(((query: any) => {
    const q = realFind(query);
    const exec = q.exec.bind(q);
    return Object.assign(q, { exec: async () => {
      const rows = await exec();
      finish();
      await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
      return rows;
    } });
  }) as typeof collection.find);
  start();
  await settle();
  await tick();
  await settle();
  expect((await request())?.toJSON()).toMatchObject({ status: 'sent', attempts: 1 });
  expect(send).toHaveBeenCalledTimes(1);
});

test('a v0 receipt email migrates to v1 with no attempts', async () => {
  const v0Schema: RxJsonSchema<Omit<ReceiptEmailRow, 'attempts' | 'nextAttemptAt' | 'lastAttemptAt' | 'saveToBilling'>> = {
    version: 0, primaryKey: 'id', type: 'object',
    properties: {
      id: { type: 'string', maxLength: 64 },
      email: { type: 'string' },
      status: { type: 'string', enum: ['queued', 'sending', 'sent', 'failed'] },
      queuedAt: { type: 'string', maxLength: 32 },
      sentAt: { type: 'string' }, error: { type: 'string' },
    },
    required: ['id', 'email', 'status', 'queuedAt'],
    indexes: ['queuedAt'],
  };
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: `emails_migration_${crypto.randomUUID()}`, multiInstance: false, storage };
  const row = { id: 'sale', email, status: 'failed', queuedAt: '2026-01-01T00:00:00.000Z', error: 'Bad address' };
  const oldDb = await createRxDatabase(options);
  try {
    const { receipt_emails } = await oldDb.addCollections({ receipt_emails: { schema: v0Schema } });
    await receipt_emails.insert(row);
  } finally {
    await oldDb.close();
  }
  const migratedDb = await createRxDatabase(options);
  try {
    const { receipt_emails } = await migratedDb.addCollections({
      receipt_emails: { schema: receiptEmailSchema, migrationStrategies: receiptEmailMigrationStrategies },
    });
    expect((await receipt_emails.findOne('sale').exec())?.toJSON()).toEqual({ ...row, attempts: 0 });
  } finally {
    await migratedDb.remove();
  }
});

test.each(['collection', 'mailer', 'orders'] as const)('does nothing without %s', async missing => {
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  renderHook(() => useReceiptEmailSender({ collection, mailer, orders, [missing]: null }));
  await settle();
  await tick();
  expect(send).not.toHaveBeenCalled();
  expect((await request())?.status).toBe('queued');
});

test('cleans up subscriptions, the online listener and interval on unmount', async () => {
  await order('sale', true);
  const remove = vi.spyOn(window, 'removeEventListener');
  const clear = vi.spyOn(globalThis, 'clearInterval');
  const { unmount } = start();
  await settle();
  unmount();
  expect(remove).toHaveBeenCalledWith('online', expect.any(Function));
  expect(clear).toHaveBeenCalled();
  await queueReceiptEmail(collection, 'sale', email);
  await tick();
  window.dispatchEvent(new Event('online'));
  await settle();
  expect(send).not.toHaveBeenCalled();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test.each([true, false])('completed sale receipt UI, mailer available: %s', async available => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  let sync!: () => void, finish!: () => void;
  const synced = new Promise<void>(resolve => { sync = resolve; });
  const delivered = new Promise<void>(resolve => { finish = resolve; });
  send.mockImplementation(async () => { await delivered; });
  const transport: CommandTransport<OrderCreateEnvelope> = { send: vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => {
    await synced;
    return { kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied',
      serverRefs: { orderId: '115', totalMinor: 300 } })) };
  }) };
  const gee = { id: '7', name: 'Gee Four', email };
  const customers = { search: vi.fn(async () => [gee]), create: vi.fn(async () => gee) };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => transport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          customers={customers} mailer={available ? mailer : null} receiptEmails={collection} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Change customer' }));
  fireEvent.change(screen.getByPlaceholderText('Search name, email or phone'), { target: { value: 'gee' } });
  fireEvent.click(await vi.waitFor(() => screen.getByLabelText('Gee Four, gee@example.invalid')));
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  await takeCash(300);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
  if (available) {
    fireEvent.click(screen.getByRole('button', { name: 'Email Receipt' }));
    expect((await vi.waitFor(() => screen.getByLabelText('Email Address')) as HTMLInputElement).value).toBe(email);
    expect(screen.getByTestId('receipt-email-send').textContent).toBe('Send when online');
    fireEvent.click(screen.getByTestId('receipt-email-send'));
    await vi.waitFor(() => expect(screen.getByText(queuedText)).not.toBeNull());
    expect(screen.queryByLabelText('Email Address')).toBeNull();
    expect(send).not.toHaveBeenCalled();
    await act(async () => { sync(); });
    await vi.waitFor(() => expect(screen.getByText('Sending the receipt…')).not.toBeNull());
    expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
    await act(async () => { finish(); });
    await vi.waitFor(() => expect(screen.getByText('Email sent')).not.toBeNull());
  } else {
    expect(screen.queryByRole('button', { name: 'Email Receipt' })).toBeNull();
    await act(async () => { sync(); finish(); });
    expect(await collection.find().exec()).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  }
  await vi.waitFor(() => expect(screen.getByText('Sales are up to date.')).not.toBeNull());
}, 20_000);

test('a queued email keeps Save to Billing for the send', async () => {
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email, undefined, { saveToBilling: true });
  start();
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, { saveToBilling: true });
});

test('an email queued without the switch sends without Save to Billing', async () => {
  await order('sale', true);
  await queueReceiptEmail(collection, 'sale', email);
  start();
  await vi.waitFor(async () => expect((await request())?.status).toBe('sent'));
  expect(send).toHaveBeenCalledExactlyOnceWith('115', email, undefined);
});
