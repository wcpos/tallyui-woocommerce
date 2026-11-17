// The cart head's + menu and settings icon (v2 pos/cart/cart-header.tsx, add-cart-items-menu.tsx, add-discount-sheet.tsx).
import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { CustomerServiceError } from '@tallyui/core';
import type { Customer, OrderCreateEnvelope, ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { Toaster } from '../components/toaster';
import { CREATE_CUSTOMERS_DENIED, CREATE_CUSTOMERS_DENIED_DEMO, DEMO_STORE_HOME, type CashierCapabilities } from '../lib/auth/capabilities';
import type { CustomerSource } from '../lib/customers/customer-source';
import { dismissToast } from '../lib/toast/toast';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { openAddMenuItem, sessionsOff } from './cart-head-helpers';
// Applying a coupon awaits an RxDB lookup, so the 1 s default async timeout flakes on CI.
configure({ asyncUtilTimeout: 5_000 });

const connector = createWooCommerceConnector();
// The coupon gate (sale-screen couponsOffered) needs coupons, order_create v6 and WooCommerce rounding with rates.
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

beforeEach(async () => {
  db = await createTallyDatabase({ connector, name: `cart_add_menu_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  await db.coupons.bulkInsert(couponDocs);
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  sessionsOff();
  // Browse All products: the flat grid these tests tap.
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
      {/* createTallyDatabase turns on RxDB dev-mode, which refuses a storage without a validator. */}
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
  return { get register() { return register; } };
}

async function addEspresso() {
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByLabelText('Edit quantity of Espresso');
}

function total() {
  const footer = within(screen.getByTestId('cart-footer'));
  return within(footer.getByText('Total').parentElement!);
}

function addCharge(item: 'misc-product' | 'fee' | 'shipping', name: string, amount: string) {
  openAddMenuItem(item);
  const form = within(within(screen.getByTestId(`add-${item}-dialog`)).getByTestId('charge-form'));
  fireEvent.change(form.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(form.getByLabelText('Amount'), { target: { value: amount } });
  fireEvent.click(form.getByRole('button', { name: 'Apply' }));
}

test('the cart head has the + menu and the settings icon; the menu lists v2\'s add items in order', async () => {
  await renderTill();
  const head = within(screen.getByTestId('cart-head'));
  expect(head.getByRole('button', { name: 'Add to cart' }).getAttribute('data-testid')).toBe('cart-add-menu');
  expect(head.getByRole('button', { name: 'Cart settings' }).getAttribute('data-testid')).toBe('cart-settings-button');
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  const menu = within(screen.getByRole('menu'));
  expect(menu.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Add Miscellaneous Product', 'Add Fee', 'Add Discount', 'Add Shipping']);
}, 20_000);

test.each([4, 3])('the charge items are hidden when orderCreate is %s', async orderCreate => {
  await renderTill({ ...COUPONS, orderCreate });
  await addEspresso();
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  expect(screen.getByTestId('cart-add-menu-discount')).not.toBeNull();
  for (const item of ['misc-product', 'fee', 'shipping']) expect(screen.queryByTestId(`cart-add-menu-${item}`)).toBeNull();
}, 20_000);

test('Add Fee, Add Shipping and Add Miscellaneous Product each open a form fixed to their kind and reach the order', async () => {
  await renderTill();
  await addEspresso();
  openAddMenuItem('misc-product');
  const dialog = within(screen.getByTestId('add-misc-product-dialog'));
  expect(dialog.getByRole('group', { name: 'Add custom item' }).getAttribute('data-testid')).toBe('charge-form');
  const form = within(dialog.getByTestId('charge-form'));
  expect(form.queryByRole('button', { name: 'Fee' })).toBeNull();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByTestId('add-misc-product-dialog')).toBeNull());
  addCharge('fee', 'Bag', '0.20');
  await waitFor(() => expect(screen.queryByTestId('add-fee-dialog')).toBeNull());
  addCharge('shipping', 'Delivery', '5.00');
  addCharge('misc-product', 'Gift wrap', '3.00');
  const feeRow = within(screen.getByTestId('cart-fee-0'));
  expect(feeRow.getByText('Bag')).not.toBeNull();
  expect(feeRow.getByText('$0.20')).not.toBeNull();
  expect(screen.queryByTestId('cart-fee-1')).toBeNull();
  const shippingRow = within(screen.getByTestId('cart-shipping-0'));
  expect(shippingRow.getByText('Delivery')).not.toBeNull();
  expect(shippingRow.getByText('$5.00')).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Gift wrap')).not.toBeNull();
  expect(total().getByText('$11.20')).not.toBeNull();
}, 20_000);

test('Quick discount applies an order discount and closes the dialog', async () => {
  await renderTill();
  await addEspresso();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  expect(dialog.getByText('Add discount')).not.toBeNull();
  expect(dialog.getByTestId('add-discount-kind-quick').getAttribute('aria-pressed')).toBe('true');
  const form = within(dialog.getByRole('group', { name: 'Order discount' }));
  fireEvent.change(form.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(form.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  expect(screen.getByRole('button', { name: /^Remove discount Order discount 10%/ })).not.toBeNull();
  expect(total().getByText('$2.70')).not.toBeNull();
}, 20_000);

test('Coupon applies a coupon, and a refusal shows inline', async () => {
  await renderTill();
  await addEspresso();
  openAddMenuItem('discount');
  fireEvent.click(screen.getByTestId('add-discount-kind-coupon'));
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  expect(dialog.queryByRole('group', { name: 'Order discount' })).toBeNull();
  fireEvent.click(await dialog.findByRole('button', { name: 'old' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  const alert = await dialog.findByText('Coupon old has expired');
  expect(alert.getAttribute('role')).toBe('alert');
  expect(total().getByText('$3.00')).not.toBeNull();
  fireEvent.click(dialog.getByRole('button', { name: 'save10' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  expect(await screen.findByTestId('coupon-chip-save10')).not.toBeNull();
  expect(total().getByText('$2.70')).not.toBeNull();
}, 20_000);

test.each([
  { name: 'coupons: false', capabilities: { ...COUPONS, coupons: false } },
  { name: 'orderCreate: 5', capabilities: { ...COUPONS, orderCreate: 5 } },
])('the Coupon switch is absent when coupons are not offered ($name)', async ({ capabilities }) => {
  await renderTill(capabilities);
  await addEspresso();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  expect(dialog.getByRole('group', { name: 'Order discount' })).not.toBeNull();
  expect(screen.queryByTestId('add-discount-kind-quick')).toBeNull();
  expect(screen.queryByTestId('add-discount-kind-coupon')).toBeNull();
}, 20_000);

test('Add Discount opens on an empty cart, and a percent discount applies to the first line', async () => {
  await renderTill();
  openAddMenuItem('discount');
  expect(screen.getByTestId('add-discount-dialog')).not.toBeNull();
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  fireEvent.change(dialog.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(screen.queryByTestId('add-discount-dialog')).toBeNull());
  await addEspresso();
  await waitFor(() => expect(total().getByText('$2.70')).not.toBeNull());
}, 20_000);

test('a fixed discount on an empty cart is refused inline', async () => {
  await renderTill();
  openAddMenuItem('discount');
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  fireEvent.click(dialog.getByRole('button', { name: 'Amount' }));
  fireEvent.change(dialog.getByLabelText('Discount value'), { target: { value: '5' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  expect(screen.getByRole('alert').textContent).toBe('The discount is more than the order');
  expect(screen.getByTestId('add-discount-dialog')).not.toBeNull();
}, 20_000);

test('the cart column has no Order discount, Add charge or Add coupon buttons; an applied order discount still shows', async () => {
  await renderTill();
  await addEspresso();
  for (const name of ['Order discount', 'Add charge', 'Add coupon']) expect(screen.queryByRole('button', { name })).toBeNull();
  expect(screen.queryByText('Order discount', { exact: true })).toBeNull();
  openAddMenuItem('discount');
  fireEvent.change(screen.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  const chip = await screen.findByRole('button', { name: /^Remove discount Order discount 10%/ });
  expect(screen.getByTestId('cart-footer').compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  for (const name of ['Order discount', 'Add charge', 'Add coupon']) expect(screen.queryByRole('button', { name })).toBeNull();
  fireEvent.click(chip);
  await waitFor(() => expect(total().getByText('$3.00')).not.toBeNull());
}, 20_000);

test('the register sessions switch is in Cart Settings, not under the cart', async () => {
  const app = await renderTill();
  expect(screen.queryByRole('switch', { name: 'Use register sessions' })).toBeNull();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const settings = within(screen.getByTestId('cart-settings'));
  expect(settings.getByText('Register sessions')).not.toBeNull();
  const toggle = settings.getByRole('switch', { name: 'Use register sessions' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(toggle);
  expect(app.register.setting).toBe(true);
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  expect(screen.queryByRole('switch', { name: 'Use register sessions' })).toBeNull();
}, 20_000);

// v2 add-cart-items-menu.tsx menu-add-customer and pos/cart/add-customer.tsx: create from the + menu, attach on save.
const gee: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid', phone: '123' };
const CAN_CREATE = { known: true, granted: ['create_customers'] } as const;
function customerSource() {
  return { search: vi.fn<CustomerSource['search']>().mockResolvedValue([]), create: vi.fn<CustomerSource['create']>().mockResolvedValue(gee) };
}
const chip = () => screen.getByTestId('cart-customer-name').getAttribute('aria-label');
const form = () => within(screen.getByTestId('customer-form'));
const submit = () => fireEvent.click(form().getByText('Add Customer'));

test('with customers, Add new customer is first, then a separator, then the add items', async () => {
  await renderTill(COUPONS, { customers: customerSource(), cashier: CAN_CREATE });
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  const menu = within(screen.getByRole('menu'));
  expect(menu.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Add new customer', 'Add Miscellaneous Product', 'Add Fee', 'Add Discount', 'Add Shipping']);
  const item = menu.getByTestId('cart-add-menu-customer');
  expect(item.getAttribute('aria-disabled')).toBeNull();
  const separator = menu.getByRole('separator');
  expect(item.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(separator.compareDocumentPosition(menu.getByTestId('cart-add-menu-misc-product')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}, 20_000);

test('without customers there is no Add new customer item', async () => {
  await renderTill();
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  expect(screen.queryByTestId('cart-add-menu-customer')).toBeNull();
  expect(screen.queryByText('Add new customer')).toBeNull();
}, 20_000);

test.each<{ name: string; cashier?: CashierCapabilities; siteHome?: string; reason: string }>([
  { name: 'permissions not read', cashier: undefined, reason: 'Your permissions have not been read from the store.' },
  { name: 'create_customers denied', cashier: { known: true, granted: [] }, reason: CREATE_CUSTOMERS_DENIED },
  { name: 'create_customers denied on the demo store', cashier: { known: true, granted: [] }, siteHome: DEMO_STORE_HOME, reason: CREATE_CUSTOMERS_DENIED_DEMO },
])('Add new customer is disabled and says why ($name)', async ({ cashier, siteHome, reason }) => {
  const customers = customerSource();
  await renderTill(COUPONS, { customers, cashier, siteHome });
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  const item = screen.getByTestId('cart-add-menu-customer');
  expect(item.getAttribute('aria-disabled')).toBe('true');
  expect(within(item).getByText(reason)).not.toBeNull();
  fireEvent.click(item);
  expect(screen.queryByTestId('customer-form')).toBeNull();
}, 20_000);

test('Add new customer requires an email, omits empty fields, toasts and attaches the created customer', async () => {
  const customers = customerSource();
  await renderTill(COUPONS, { customers, cashier: CAN_CREATE });
  expect(chip()).toBe('Customer: Guest');
  openAddMenuItem('customer');
  expect(screen.getByRole('heading', { name: 'Add Customer' })).not.toBeNull();
  expect(form().queryByPlaceholderText('Street address')).toBeNull();
  fireEvent.change(form().getByPlaceholderText('email@example.com'), { target: { value: '   ' } });
  submit();
  expect(screen.getByTestId('customer-form-error').textContent).toBe('An email is required');
  expect(customers.create).not.toHaveBeenCalled();
  fireEvent.change(form().getByPlaceholderText('email@example.com'), { target: { value: ' gee@example.invalid ' } });
  fireEvent.change(form().getByPlaceholderText('First name'), { target: { value: ' Gee ' } });
  fireEvent.change(form().getByPlaceholderText('Last name'), { target: { value: '  ' } });
  submit();
  await waitFor(() => expect(screen.queryByTestId('customer-form')).toBeNull());
  expect(customers.create).toHaveBeenCalledExactlyOnceWith({ email: 'gee@example.invalid', firstName: 'Gee' });
  expect(within(screen.getByTestId('success-toast')).getByText('Gee Four saved')).not.toBeNull();
  expect(chip()).toBe('Customer: Gee Four');
}, 20_000);

test.each([
  { name: 'unreachable', cause: new CustomerServiceError('network', 'Offline'), message: "Could not reach the store's customers: Offline" },
  { name: 'refused', cause: new CustomerServiceError('invalid', 'An account is already registered with your email address.'),
    message: 'The store refused: An account is already registered with your email address.' },
])('a failed create ($name) toasts the message, keeps the form and leaves the customer', async ({ cause, message }) => {
  const customers = customerSource();
  customers.create.mockRejectedValueOnce(cause);
  await renderTill(COUPONS, { customers, cashier: CAN_CREATE });
  openAddMenuItem('customer');
  fireEvent.change(form().getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
  submit();
  const toast = await screen.findByTestId('error-toast');
  expect(within(toast).getByText('Failed to save customer')).not.toBeNull();
  expect(within(toast).getByText(message)).not.toBeNull();
  expect(screen.queryByTestId('success-toast')).toBeNull();
  expect(screen.getByTestId('customer-form')).not.toBeNull();
  fireEvent.click(screen.getByTestId('customer-form-close'));
  expect(chip()).toBe('Customer: Guest');
}, 20_000);
