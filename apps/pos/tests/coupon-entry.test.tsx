import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import type { OrderCreateEnvelope, ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { parkedTabs, resumeFromList } from './open-orders-helpers';
import { openAddMenuItem } from './cart-head-helpers';
// Applying a coupon awaits an RxDB lookup, so the 1 s default async timeout flakes on CI.
configure({ asyncUtilTimeout: 5_000 });

addRxPlugin(RxDBMigrationSchemaPlugin);

function SaleScreen(props: ComponentProps<typeof SaleScreenWithoutHost>) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const connector = createWooCommerceConnector();
const COUPONS: ServerCapabilities = { orderCreate: 6, coupons: true, multiplePayments: false,
  taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false } };
// Coupon replay runs only under WooCommerce rounding with rates, so the store has both.
const wooSettings: StoreSettings = { ...noTaxSettings, taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
  taxRates: { default: [] } };
const couponBase = { usage_count: 0, used_by: [] };
const couponDocs = [
  { uuid: 'c-1', id: 1, code: 'save10', status: 'publish', discount_type: 'percent', amount: '10', description: 'Ten percent off', ...couponBase },
  { uuid: 'c-2', id: 2, code: 'fiveoff', status: 'publish', discount_type: 'fixed_cart', amount: '5', ...couponBase },
  { uuid: 'c-3', id: 3, code: 'old', status: 'publish', discount_type: 'percent', amount: '20',
    date_expires: '2020-01-01T00:00:00', date_expires_gmt: '2020-01-01T00:00:00', ...couponBase },
  { uuid: 'c-4', id: 4, code: 'drafty', status: 'draft', discount_type: 'percent', amount: '50', ...couponBase },
  { uuid: 'c-5', id: 5, code: 'credit50', status: 'publish', discount_type: 'store_credit', amount: '50', ...couponBase },
];

let db: Awaited<ReturnType<typeof createTallyDatabase>>;
let transport: CommandTransport<OrderCreateEnvelope>;

beforeEach(async () => {
  db = await createTallyDatabase({ connector, name: `coupon_entry_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  await db.coupons.bulkInsert(couponDocs);
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  transport = { send: vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied',
      serverRefs: { orderId: '305', displayId: '305', totalMinor: 270 } })) })) };
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.close();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function renderTill(capabilities: ServerCapabilities = COUPONS, parkedCarts?: ParkedCartCollection) {
  render(
    <SessionProvider>
      {/* createTallyDatabase turns on RxDB dev-mode, which refuses a storage without a validator. */}
      <OutboxProvider transportFor={() => transport} storage={wrappedValidateAjvStorage({ storage: getRxStorageMemory() })}>
        <OrderStoreReady />
        <SaleScreen storeSettings={wooSettings} connector={connector} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          capabilities={capabilities} couponCollections={{ coupons: db.coupons, products: db.products }}
          parkedCarts={parkedCarts} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
}

async function addEspresso() {
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByLabelText('Edit quantity of Espresso');
}

// v2's cart + menu: Add discount, then its Coupon side.
async function openPicker() {
  openAddMenuItem('discount');
  fireEvent.click(await screen.findByTestId('add-discount-kind-coupon'));
  await screen.findByRole('button', { name: 'save10' });
}

async function applyCoupon(code: string) {
  await openPicker();
  fireEvent.click(screen.getByRole('button', { name: code }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

// RNW's Pressable takes its new onPress in a passive effect, and under CI load the chip can show before that effect runs:
// + then parks the order from the render before the coupon. The empty act waits a task, after React's pending effects.
async function parkWithPlus() {
  await act(async () => {});
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
}

function total() {
  const footer = within(screen.getByTestId('cart-footer'));
  return within(footer.getByText('Total').parentElement!);
}

test.each([
  { name: 'coupons: false', capabilities: { ...COUPONS, coupons: false } },
  { name: 'orderCreate: 5', capabilities: { ...COUPONS, orderCreate: 5 } },
])('the coupon entry is hidden when the store lacks the coupon gate ($name)', async ({ capabilities }) => {
  await renderTill(capabilities);
  await addEspresso();
  expect(total().getByText('$3.00')).not.toBeNull();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  expect(dialog.getByRole('group', { name: 'Order discount' })).not.toBeNull();
  expect(screen.queryByTestId('add-discount-kind-coupon')).toBeNull();
  expect(screen.queryByPlaceholderText('Search coupons...')).toBeNull();
}, 20_000);

test('the picker lists published coupons, searches them, and shows No coupons found', async () => {
  await renderTill();
  await addEspresso();
  await openPicker();
  expect(screen.getByText('Select coupon...')).not.toBeNull();
  const save10 = within(screen.getByRole('button', { name: 'save10' }));
  expect(save10.getByText('Ten percent off')).not.toBeNull();
  expect(save10.getByText('10%')).not.toBeNull();
  const fiveoff = within(screen.getByRole('button', { name: 'fiveoff' }));
  expect(fiveoff.getByText('Fixed cart discount')).not.toBeNull();
  expect(fiveoff.getByText('$5.00')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'old' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'drafty' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'fiveoff' }));
  expect(screen.getByRole('button', { name: 'fiveoff' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(false);
  const search = screen.getByPlaceholderText('Search coupons...');
  fireEvent.change(search, { target: { value: 'five' } });
  expect(screen.getByRole('button', { name: 'fiveoff' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'save10' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'old' })).toBeNull();
  fireEvent.change(search, { target: { value: 'TEN PERCENT' } });
  expect(screen.getByRole('button', { name: 'save10' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'fiveoff' })).toBeNull();
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(screen.getByText('No coupons found')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByPlaceholderText('Search coupons...')).toBeNull());
  await openPicker();
  expect((screen.getByPlaceholderText('Search coupons...') as HTMLInputElement).value).toBe('');
  expect(screen.getByText('Select coupon...')).not.toBeNull();
}, 20_000);

test('applying an expired coupon shows the refusal inline and keeps the dialog open', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('old');
  const alert = await screen.findByText('Coupon old has expired');
  expect(alert.getAttribute('role')).toBe('alert');
  expect(screen.getByRole('button', { name: 'Apply' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove coupon old' })).toBeNull();
  expect(total().getByText('$3.00')).not.toBeNull();
}, 20_000);

test('picking another coupon clears the error, as v2 (add-coupon.tsx:62-68)', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('old');
  await screen.findByText('Coupon old has expired');
  fireEvent.click(screen.getByRole('button', { name: 'save10' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('Coupon old has expired')).toBeNull();
}, 20_000);

test('typing in the search clears the error, as v2 (add-coupon.tsx:106,166-172)', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('old');
  await screen.findByText('Coupon old has expired');
  fireEvent.change(screen.getByPlaceholderText('Search coupons...'), { target: { value: 'five' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('Coupon old has expired')).toBeNull();
}, 20_000);

test('the coupon error sits above the search field, as v2 (add-coupon.tsx:88-90)', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('old');
  const alert = await screen.findByText('Coupon old has expired');
  expect(alert.compareDocumentPosition(screen.getByPlaceholderText('Search coupons...')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}, 20_000);

test('a coupon of a type the POS cannot apply says so inline, as v2, and is not applied', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('credit50');
  const alert = await screen.findByText("credit50 can't be applied in the POS: its coupon type (store_credit) comes from another plugin. Only percentage and fixed discount coupons are supported.");
  expect(alert.getAttribute('role')).toBe('alert');
  // Had the picker gone on to applyCoupon, TallyUI's own refusal would replace this one after its RxDB lookup.
  await expect(screen.findByText('Coupon credit50 does not exist', {}, { timeout: 1_500 })).rejects.toThrow();
  expect(screen.getByRole('alert').textContent).toBe("credit50 can't be applied in the POS: its coupon type (store_credit) comes from another plugin. Only percentage and fixed discount coupons are supported.");
  expect(screen.getByRole('button', { name: 'Apply' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove coupon credit50' })).toBeNull();
  expect(total().getByText('$3.00')).not.toBeNull();
}, 20_000);

test('an applied coupon shows a chip; removing it restores the total', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('save10');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull());
  const chip = within(screen.getByTestId('coupon-chip-save10'));
  expect(chip.getByText('save10')).not.toBeNull();
  expect(chip.getByText('−$0.30')).not.toBeNull();
  expect(total().getByText('$2.70')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove coupon save10' }));
  await waitFor(() => expect(screen.queryByTestId('coupon-chip-save10')).toBeNull());
  expect(total().getByText('$3.00')).not.toBeNull();
}, 20_000);

test('an applied coupon is a row under Subtotal, inside the cart footer', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('save10');
  const rowEl = await screen.findByTestId('coupon-chip-save10');
  const footerEl = screen.getByTestId('cart-footer');
  expect(footerEl.contains(rowEl)).toBe(true);
  const subtotalEl = within(footerEl).getByText('Subtotal');
  const totalEl = within(footerEl).getByText('Total');
  expect(subtotalEl.compareDocumentPosition(rowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(rowEl.compareDocumentPosition(totalEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}, 20_000);

test('an applied coupon is counted once: no Discount row repeats it', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('save10');
  await screen.findByTestId('coupon-chip-save10');
  const footer = within(screen.getByTestId('cart-footer'));
  expect(footer.queryByText('Discount', { exact: true })).toBeNull();
  expect(footer.getAllByText('−$0.30')).toHaveLength(1);
  expect(total().getByText('$2.70')).not.toBeNull();
}, 20_000);

test('with two coupons, no Discount row repeats either', async () => {
  await renderTill();
  await addEspresso();
  fireEvent.click(screen.getAllByText('Espresso').find(el => !screen.getByTestId('cart-pane').contains(el))!);
  await waitFor(() => expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('2'));
  fireEvent.click(screen.getAllByText('Espresso').find(el => !screen.getByTestId('cart-pane').contains(el))!);
  await waitFor(() => expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('3'));
  await applyCoupon('save10');
  await screen.findByTestId('coupon-chip-save10');
  await applyCoupon('fiveoff');
  await screen.findByTestId('coupon-chip-fiveoff');
  const footer = within(screen.getByTestId('cart-footer'));
  expect(footer.queryByText('Discount', { exact: true })).toBeNull();
  // Observed from TallyUI totals for three espressos with save10 and fiveoff.
  expect(within(screen.getByTestId('coupon-chip-save10')).getByText('−$0.90')).not.toBeNull();
  expect(within(screen.getByTestId('coupon-chip-fiveoff')).getByText('−$5.00')).not.toBeNull();
  expect(footer.getAllByText('−$0.90')).toHaveLength(1);
  expect(footer.getAllByText('−$5.00')).toHaveLength(1);
  expect(total().getByText('$3.10')).not.toBeNull();
}, 20_000);

test('with an order discount and a coupon, the Discount row shows the order discount only', async () => {
  await renderTill();
  await addEspresso();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  const form = within(dialog.getByRole('group', { name: 'Order discount' }));
  fireEvent.change(form.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(form.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  await applyCoupon('save10');
  const chip = within(await screen.findByTestId('coupon-chip-save10'));
  expect(screen.getByRole('button', { name: /^Remove discount Order discount 10%/ })).not.toBeNull();
  const footer = within(screen.getByTestId('cart-footer'));
  // Observed from TallyUI's totals: $0.30 order discount, $0.27 coupon, $0.57 combined, $2.43 total.
  expect(within(footer.getByText('Discount', { exact: true }).parentElement!).getByText('−$0.30')).not.toBeNull();
  expect(chip.getByText('−$0.27')).not.toBeNull();
  expect(footer.getAllByText('−$0.27')).toHaveLength(1);
  expect(total().getByText('$2.43')).not.toBeNull();
}, 20_000);

test('the receipt lists each coupon with its amount', async () => {
  await renderTill();
  await addEspresso();
  await applyCoupon('save10');
  await screen.findByTestId('coupon-chip-save10');
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(270);
  const coupons = within(await screen.findByTestId('receipt-coupons'));
  expect(coupons.getByText('Coupon save10')).not.toBeNull();
  expect(coupons.getByText('-$0.30')).not.toBeNull();
}, 20_000);

test('a parked sale keeps its coupon', async () => {
  const parkedDb = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await parkedDb.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    await renderTill(COUPONS, parkedCarts);
    await addEspresso();
    await applyCoupon('save10');
    await screen.findByTestId('coupon-chip-save10');
    await parkWithPlus();
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    expect((await parkedCarts.find().exec())[0].toJSON().coupons).toEqual(['save10']);
    await waitFor(() => expect(screen.queryByTestId('coupon-chip-save10')).toBeNull());
    await resumeFromList();
    const chip = within(await screen.findByTestId('coupon-chip-save10'));
    expect(chip.getByText('−$0.30')).not.toBeNull();
    await waitFor(() => expect(total().getByText('$2.70')).not.toBeNull());

    await (await db.coupons.findOne('c-1').exec())!.remove();
    await waitFor(() => expect(screen.queryByTestId('open-orders-list')).toBeNull());
    await parkWithPlus();
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    await resumeFromList();
    expect(await screen.findByText('Coupon save10 was removed: Coupon save10 does not exist.')).not.toBeNull();
    await screen.findByLabelText('Edit quantity of Espresso');
    expect(screen.queryByTestId('coupon-chip-save10')).toBeNull();
    expect(total().getByText('$3.00')).not.toBeNull();
  } finally {
    cleanup();
    await parkedDb.remove();
  }
}, 20_000);
