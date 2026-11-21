import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest';
import * as ReactNative from 'react-native';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import type { OrderCreateEnvelope, ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CommandTransport, Logger } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { CartAddMenu } from '../components/cart-add-menu';
import { Toaster } from '../components/toaster';
import type { CustomerSource } from '../lib/customers/customer-source';
import { dismissToast } from '../lib/toast/toast';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { cartLogger } from '../lib/sale/cart-log';
import { attachLogStore, logRecordMigrationStrategies, logRecordSchema, TALLYUI_LOGGERS, type LogCollection } from '../lib/logs/log-store';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { openAddMenuItem, sessionsOff } from './cart-head-helpers';
import { openParkedList, parkedRow } from './open-orders-helpers';

configure({ asyncUtilTimeout: 5_000 });
addRxPlugin(RxDBMigrationSchemaPlugin);
const connector = createWooCommerceConnector();
const COUPONS: ServerCapabilities = { orderCreate: 6, coupons: true, multiplePayments: false,
  taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false } };
const wooSettings: StoreSettings = { ...noTaxSettings, taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
  taxRates: { default: [] } };
const couponBase = { usage_count: 0, used_by: [] };
const couponDocs = [
  { uuid: 'c-1', id: 1, code: 'save10', status: 'publish', discount_type: 'percent', amount: '10', ...couponBase },
  { uuid: 'c-3', id: 3, code: 'old', status: 'publish', discount_type: 'percent', amount: '20',
    date_expires: '2020-01-01T00:00:00', date_expires_gmt: '2020-01-01T00:00:00', ...couponBase },
];
let db: Awaited<ReturnType<typeof createTallyDatabase>>;
let info: MockInstance<Logger['info']>;

beforeEach(async () => {
  info = vi.spyOn(cartLogger, 'info');
  db = await createTallyDatabase({ connector, name: `cart_activity_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  await db.coupons.bulkInsert(couponDocs);
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  sessionsOff();
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});
afterEach(async () => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.close();
});

async function renderTill(capabilities: ServerCapabilities = COUPONS,
  customer: Pick<ComponentProps<typeof SaleScreen>, 'customers' | 'cashier' | 'siteHome'> = {}) {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '305', totalMinor: 300 } })) }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={wrappedValidateAjvStorage({ storage: getRxStorageMemory() })}>
        <RegisterProvider>
          <Probe />
          <SaleScreen storeSettings={wooSettings} connector={connector} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            capabilities={capabilities} couponCollections={{ coupons: db.coupons, products: db.products }} {...customer} />
          <PortalHost />
          <Toaster />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(outbox.enabled && outbox.orders && register?.boundRegisterId).toBeTruthy());
}
async function addEspresso() {
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByLabelText('Edit quantity of Espresso');
}
function addCharge(item: 'misc-product' | 'fee' | 'shipping', name: string, amount: string) {
  openAddMenuItem(item);
  const form = within(within(screen.getByTestId(`add-${item}-dialog`)).getByTestId('charge-form'));
  fireEvent.change(form.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(form.getByLabelText('Amount'), { target: { value: amount } });
  fireEvent.click(form.getByRole('button', { name: 'Apply' }));
}

test('adds, fees, shipping, custom line and quick discount each log once, in order', async () => {
  await renderTill();
  await addEspresso();
  addCharge('fee', 'Bag', '0.20');
  await waitFor(() => expect(screen.queryByTestId('add-fee-dialog')).toBeNull());
  addCharge('shipping', 'Delivery', '5.00');
  await waitFor(() => expect(screen.queryByTestId('add-shipping-dialog')).toBeNull());
  addCharge('misc-product', 'Gift wrap', '3.00');
  await waitFor(() => expect(screen.queryByTestId('add-misc-product-dialog')).toBeNull());
  openAddMenuItem('discount');
  const form = within(screen.getByRole('group', { name: 'Order discount' }));
  fireEvent.change(form.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(form.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  expect(info.mock.calls.map(call => call[0])).toEqual([
    'Espresso added to cart', 'Fee added: Bag', 'Shipping added: Delivery', 'Gift wrap added to cart', 'Quick discount added',
  ]);
}, 20_000);

test('a coupon logs its code; a refused coupon logs nothing', async () => {
  await renderTill();
  await addEspresso();
  openAddMenuItem('discount');
  fireEvent.click(screen.getByTestId('add-discount-kind-coupon'));
  let dialog = within(screen.getByTestId('add-discount-dialog'));
  fireEvent.click(await dialog.findByRole('button', { name: 'save10' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  expect(await screen.findByTestId('coupon-chip-save10')).not.toBeNull();
  expect(info.mock.calls).toContainEqual(['Coupon applied', { code: 'save10' }]);
  expect(info.mock.calls.map(call => call[0])).toEqual(['Espresso added to cart', 'Coupon applied']);
  openAddMenuItem('discount');
  fireEvent.click(screen.getByTestId('add-discount-kind-coupon'));
  dialog = within(screen.getByTestId('add-discount-dialog'));
  fireEvent.click(await dialog.findByRole('button', { name: 'old' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  expect((await dialog.findByText('Coupon old has expired')).getAttribute('role')).toBe('alert');
  expect(info.mock.calls.map(call => call[0])).toEqual(['Espresso added to cart', 'Coupon applied']);
}, 20_000);

test('a refused charge logs nothing', async () => {
  await renderTill();
  await addEspresso();
  addCharge('fee', 'Bag', '-1');
  expect(await screen.findByText('Enter a price of 0 or more.')).not.toBeNull();
  expect(info.mock.calls.map(call => call[0])).toEqual(['Espresso added to cart']);
}, 20_000);

test('picking a customer logs their name and id; a refused customer logs nothing', async () => {
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
  const customers = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  await renderTill(COUPONS, { customers });
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  await screen.findByRole('button', { name: 'Customer: Gee Four' });
  expect(info.mock.calls).toContainEqual(['Customer assigned: Gee Four', { customerId: '7' }]);
  expect(info.mock.calls.map(call => call[0])).toEqual(['Customer assigned: Gee Four']);
  info.mockClear();
  const bad = { id: '8', name: 'Bad Mail', email: 'a'.repeat(300) + '@example.invalid' };
  customers.search.mockResolvedValue([bad]);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'bad' } });
  fireEvent.click(await screen.findByLabelText(`Bad Mail, ${bad.email}`));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull());
  expect(info.mock.calls.map(call => call[0])).toEqual([]);
}, 20_000);

test('resuming a parked cart writes no cart rows', async () => {
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
  const customers = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  await renderTill(COUPONS, { customers });
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  await addEspresso();
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  info.mockClear();
  openParkedList();
  const row = parkedRow();
  expect(within(row).getByText('Gee Four')).not.toBeNull();
  await act(async () => { fireEvent.click(row); });
  await waitFor(() => expect(screen.queryByTestId('open-orders-list')).toBeNull());
  expect(await screen.findByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso')).not.toBeNull();
  expect(info.mock.calls.map(call => call[0])).toEqual([]);
}, 20_000);

test('the store keeps cart rows', async () => {
  vi.restoreAllMocks();
  const logsDb = await createRxDatabase({ name: `cart_logs_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  const { logs } = await logsDb.addCollections<{ logs: LogCollection }>({
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } });
  const store = attachLogStore(logs, { loggers: TALLYUI_LOGGERS });
  try {
    cartLogger.info('Fee added: Bag');
    await store.flush();
    const rows = await logs.find().exec();
    expect(rows).toHaveLength(1);
    expect(rows[0].toJSON()).toMatchObject({ scope: 'cart', level: 'info', message: 'Fee added: Bag' });
  } finally {
    await store.detach();
    await logsDb.close();
  }
});

test('a refused quick discount logs nothing', async () => {
  await renderTill();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  fireEvent.click(dialog.getByRole('button', { name: 'Amount' }));
  fireEvent.change(dialog.getByLabelText('Discount value'), { target: { value: '5' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  expect((await screen.findByRole('alert')).textContent).toBe('The discount is more than the order');
  expect(info.mock.calls.map(call => call[0])).toEqual([]);
}, 20_000);

test('Add new customer logs the created customer', async () => {
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid', phone: '123' };
  const CAN_CREATE = { known: true, granted: ['create_customers'] } as const;
  function customerSource() {
    return { search: vi.fn<CustomerSource['search']>().mockResolvedValue([]), create: vi.fn<CustomerSource['create']>().mockResolvedValue(gee) };
  }
  const customers = customerSource();
  await renderTill(COUPONS, { customers, cashier: CAN_CREATE });
  openAddMenuItem('customer');
  const form = within(screen.getByTestId('customer-form'));
  fireEvent.change(form.getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
  fireEvent.change(form.getByPlaceholderText('First name'), { target: { value: 'Gee' } });
  fireEvent.click(screen.getByTestId('customer-form-add'));
  await waitFor(() => expect(screen.queryByTestId('customer-form')).toBeNull());
  expect(await screen.findByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  expect(info.mock.calls).toContainEqual(['Customer assigned: Gee Four', { customerId: '7' }]);
}, 20_000);

test('a charge the sale refuses logs nothing', () => {
  const sale = {
    order: { currency: 'USD', lineItems: [], customer: null },
    capabilities: { orderCreate: 6 },
    addFee: vi.fn(() => 'Refused by the sale'),
    addShipping: vi.fn(), addCustomLine: vi.fn(), applyDiscount: vi.fn(),
    setCustomer: vi.fn(),
  };
  render(<>
    <CartAddMenu sale={sale as any} coupons={null} couponsOffered={false} />
    <PortalHost />
  </>);
  addCharge('fee', 'Bag', '0.20');
  expect(sale.addFee).toHaveBeenCalledOnce();
  expect(info.mock.calls.map(call => call[0])).not.toContain('Fee added: Bag');
}, 20_000);
