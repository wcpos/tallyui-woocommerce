import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { Customer, OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { CustomerPicker } from '../components/customer-picker';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import type { CustomerSource } from '../lib/customers/customer-source';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { CREATE_CUSTOMERS_DENIED } from '../lib/auth/capabilities';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

function SaleScreen(props: ComponentProps<typeof SaleScreenWithoutHost>) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const gee: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid', phone: '123' };
const summary = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
// The default list (search '') the picker loads on open; typed searches answer gee.
const anna: Customer = { id: '3', name: 'Anna Bell', email: 'anna@example.invalid' };
const annaLabel = 'Anna Bell, anna@example.invalid';
const geeLabel = 'Gee Four, gee@example.invalid';
const search = vi.fn<CustomerSource['search']>();
const create = vi.fn<CustomerSource['create']>();
const source = { search, create };
const onChange = vi.fn();
const saleProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2', status: 'ready' as const, onSignOut: () => {},
};

beforeEach(() => {
  search.mockReset().mockImplementation(async query => (query ? [gee] : [anna]));
  create.mockReset().mockResolvedValue(gee);
  onChange.mockReset();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => {
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function openPicker(customer: Customer | null = null) {
  render(<CustomerPicker source={source} customer={customer} onChange={onChange} />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
}

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value } });
}

test('blocks new customers and shows the supplied reason', () => {
  render(<CustomerPicker source={source} customer={null} onChange={onChange} createBlockedReason="Locked because" />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  const button = screen.getByRole('button', { name: 'New customer' });
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(screen.queryByPlaceholderText('email@example.com')).toBeNull();
  expect(screen.getByText('Locked because')).not.toBeNull();
});

test('SaleScreen closes creation when cashier permissions have not been read', () => {
  render(<SaleScreen storeSettings={noTaxSettings} {...saleProps} customers={source} />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  expect(screen.getByRole('button', { name: 'New customer' }).getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByText('Your permissions have not been read from the store.')).not.toBeNull();
});

test('SaleScreen allows a cashier with create_customers to open the form', () => {
  render(<SaleScreen storeSettings={noTaxSettings} {...saleProps} customers={source} cashier={{ known: true, granted: ['create_customers'] }} />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  const button = screen.getByRole('button', { name: 'New customer' });
  expect(button.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(button);
  expect(screen.getByPlaceholderText('email@example.com')).not.toBeNull();
});

test('SaleScreen explains how to grant customer creation when the known list denies it', () => {
  render(<SaleScreen storeSettings={noTaxSettings} {...saleProps} customers={source} cashier={{ known: true, granted: [] }} />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  expect(screen.getByRole('button', { name: 'New customer' }).getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByText(CREATE_CUSTOMERS_DENIED)).not.toBeNull();
});

test('searches from two trimmed characters and attaches the selected summary', async () => {
  openPicker();
  expect(screen.getAllByPlaceholderText('Search Customers')).toHaveLength(1);
  expect(search).toHaveBeenCalledExactlyOnceWith('');
  typeQuery('g');
  expect(search).toHaveBeenCalledExactlyOnceWith('');
  typeQuery(' g ');
  expect(search).toHaveBeenCalledExactlyOnceWith('');
  typeQuery('gee');
  expect(search).toHaveBeenCalledWith('gee');
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(summary);
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
});

test('opening lists the default customers under Guest, and picking one attaches it', async () => {
  openPicker();
  expect(search).toHaveBeenCalledExactlyOnceWith('');
  const option = await screen.findByLabelText(annaLabel);
  expect(within(option).getByText('Anna Bell')).not.toBeNull();
  expect(within(option).getByText('anna@example.invalid')).not.toBeNull();
  const guest = screen.getByTestId('customer-option-guest');
  expect(guest.compareDocumentPosition(option) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(option);
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ id: '3', name: 'Anna Bell', email: 'anna@example.invalid' });
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
});

test('clearing the field after a typed search shows the default list again', async () => {
  openPicker();
  await screen.findByLabelText(annaLabel);
  typeQuery('gee');
  expect(await screen.findByLabelText(geeLabel)).not.toBeNull();
  expect(screen.queryByLabelText(annaLabel)).toBeNull();
  typeQuery('');
  expect(await screen.findByLabelText(annaLabel)).not.toBeNull();
  expect(screen.queryByLabelText(geeLabel)).toBeNull();
  // The open's default list is reused, not fetched again.
  expect(search.mock.calls).toEqual([[''], ['gee']]);
});

test('a default list that arrives after a typed search never replaces the typed results', async () => {
  let resolveDefault!: (customers: Customer[]) => void;
  search.mockImplementationOnce(() => new Promise(resolve => { resolveDefault = resolve; }));
  openPicker();
  typeQuery('gee');
  expect(await screen.findByLabelText(geeLabel)).not.toBeNull();
  await act(async () => { resolveDefault([anna]); });
  expect(screen.queryByLabelText(annaLabel)).toBeNull();
  expect(screen.getByLabelText(geeLabel)).not.toBeNull();
  expect(screen.queryByText('No customers found')).toBeNull();
});

test('an empty default list says No customers found until the next request', async () => {
  let resolveTyped!: (customers: Customer[]) => void;
  search.mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise(resolve => { resolveTyped = resolve; }));
  openPicker();
  expect(await screen.findByText('No customers found')).not.toBeNull();
  typeQuery('gee');
  expect(screen.queryByText('No customers found')).toBeNull();
  await act(async () => { resolveTyped([gee]); });
  expect(screen.getByLabelText(geeLabel)).not.toBeNull();
  expect(screen.queryByText('No customers found')).toBeNull();
});

test('closing before the default list arrives leaves nothing behind, and reopening loads afresh', async () => {
  let resolveDefault!: (customers: Customer[]) => void;
  search.mockImplementationOnce(() => new Promise(resolve => { resolveDefault = resolve; }));
  openPicker();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await act(async () => { resolveDefault([gee]); });
  expect(screen.getByRole('button', { name: 'Customer: Guest' })).not.toBeNull();
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  expect(await screen.findByLabelText(annaLabel)).not.toBeNull();
  expect(screen.queryByLabelText(geeLabel)).toBeNull();
  expect(screen.queryByText('No customers found')).toBeNull();
  expect(search.mock.calls).toEqual([[''], ['']]);
});

test('only shows results for the latest query when answers arrive out of order', async () => {
  let resolveFirst!: (customers: Customer[]) => void;
  search.mockResolvedValueOnce([])
    .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce([{ id: '8', name: 'New Customer' }]);
  openPicker();
  typeQuery('gee');
  typeQuery('new');
  expect(await screen.findByLabelText('New Customer')).not.toBeNull();
  await act(async () => { resolveFirst([gee]); });
  expect(screen.queryByLabelText('Gee Four, gee@example.invalid')).toBeNull();
  expect(screen.getByLabelText('New Customer')).not.toBeNull();
  fireEvent.click(screen.getByLabelText('New Customer'));
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ id: '8', name: 'New Customer' });
});

test('a short query shows the default list and invalidates a pending search', async () => {
  let resolvePending!: (customers: Customer[]) => void;
  openPicker();
  typeQuery('gee');
  await screen.findByLabelText('Gee Four, gee@example.invalid');
  typeQuery('g');
  expect(await screen.findByLabelText(annaLabel)).not.toBeNull();
  expect(screen.queryByLabelText('Gee Four, gee@example.invalid')).toBeNull();
  search.mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve; }));
  typeQuery('four');
  typeQuery('');
  await act(async () => { resolvePending([gee]); });
  expect(screen.queryByLabelText('Gee Four, gee@example.invalid')).toBeNull();
  expect(screen.getByLabelText(annaLabel)).not.toBeNull();
  expect(search).toHaveBeenCalledTimes(3);
});

test('requires email, omits empty fields and attaches the created customer', async () => {
  openPicker();
  fireEvent.click(screen.getByRole('button', { name: 'New customer' }));
  expect(screen.queryByPlaceholderText('Street address')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: '   ' } });
  fireEvent.click(screen.getByText('Create customer'));
  expect(screen.getByText('An email is required')).not.toBeNull();
  expect(create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: ' gee@example.invalid ' } });
  fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: ' Gee ' } });
  fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: '  ' } });
  fireEvent.click(screen.getByText('Create customer'));
  await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith(summary));
  expect(create).toHaveBeenCalledExactlyOnceWith({ email: 'gee@example.invalid', firstName: 'Gee' });
  expect(screen.queryByText('Create customer')).toBeNull();
});

test.each(['search', 'create'] as const)('failed %s keeps the attached customer and shows the message', async method => {
  if (method === 'search') search.mockResolvedValueOnce([anna]);
  source[method].mockRejectedValueOnce(new CustomerServiceError('network', 'Offline'));
  openPicker(gee);
  if (method === 'search') typeQuery('gee');
  else {
    fireEvent.click(screen.getByRole('button', { name: 'New customer' }));
    fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
    fireEvent.click(screen.getByText('Create customer'));
  }
  expect(await screen.findByText("Could not reach the store's customers: Offline")).not.toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
});

test('a refused create shows the store message without changing the customer', async () => {
  create.mockRejectedValueOnce(new CustomerServiceError('invalid', 'An account is already registered with your email address.'));
  openPicker();
  fireEvent.click(screen.getByRole('button', { name: 'New customer' }));
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
  fireEvent.click(screen.getByText('Create customer'));
  expect(await screen.findByText('The store refused: An account is already registered with your email address.')).not.toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test('unauthorized search asks for sign-in without showing the underlying error', async () => {
  search.mockResolvedValueOnce([anna]).mockRejectedValueOnce(new ConnectorUnauthorizedError('Private error detail', 401));
  openPicker(gee);
  typeQuery('gee');
  expect(await screen.findByText('Sign in again to search customers')).not.toBeNull();
  expect(screen.queryByText(/Private error detail/)).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test('Guest clears the attached customer', () => {
  render(<CustomerPicker source={source} customer={gee} onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.click(screen.getByTestId('customer-option-guest'));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
});

test('a guest order shows the Customer label and a Guest chip', () => {
  render(<CustomerPicker source={source} customer={null} onChange={onChange} />);
  expect(screen.getByText('Customer')).not.toBeNull();
  const chip = screen.getByTestId('cart-customer-name');
  expect(within(chip).getByTestId('cart-customer-initials').textContent).toBe('GU');
  expect(within(chip).getByText('Guest')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Change customer' })).toBeNull();
});

test('a customer chip shows initials and the name under the customer accessible name', () => {
  render(<CustomerPicker source={source} customer={gee} onChange={onChange} />);
  const chip = screen.getByRole('button', { name: 'Customer: Gee Four' });
  expect(chip.getAttribute('data-testid')).toBe('cart-customer-name');
  expect(within(chip).getByTestId('cart-customer-initials').textContent).toBe('GF');
  expect(within(chip).getByText('Gee Four')).not.toBeNull();
});

test('the Guest option clears the customer and closes the panel', () => {
  openPicker(gee);
  expect(screen.getByPlaceholderText('Search Customers')).not.toBeNull();
  fireEvent.click(screen.getByTestId('customer-option-guest'));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
});

test('a guest order still lists Guest first above Search Customers', () => {
  openPicker();
  const guest = screen.getByTestId('customer-option-guest');
  expect(guest.getAttribute('role')).toBe('button');
  expect(within(guest).getByText('GU')).not.toBeNull();
  expect(within(guest).getByText('Guest')).not.toBeNull();
  expect(screen.getByPlaceholderText('Search Customers')).not.toBeNull();
});

test.each([undefined, null])('no customer controls without a source (%s)', customers => {
  render(<SaleScreen storeSettings={noTaxSettings} {...saleProps} customers={customers} />);
  expect(screen.queryByTestId('cart-customer-name')).toBeNull();
  expect(screen.queryByText('Guest')).toBeNull();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test('sends the picked customer with a cash sale, then sends a guest after New sale', async () => {
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} {...saleProps} customers={source} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  expect(screen.getByText('Guest')).not.toBeNull();
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  typeQuery('gee');
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(screen.getByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const first = send.mock.calls.flatMap(([batch]) => batch);
  expect(first).toHaveLength(1);
  expect(first[0].type).toBe('order.create');
  expect(first[0].version).toBe(3);
  expect(first[0].payload.customer).toEqual({ customerId: '7', email: 'gee@example.invalid' });
  await screen.findByText('Sales are up to date.');
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  expect(screen.getByText('Guest')).not.toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(2);
  expect(envelopes[1].type).toBe('order.create');
  expect(envelopes[1].version).toBe(3);
  expect(envelopes[1].payload.customer).toBeNull();
  await screen.findByText('Sales are up to date.');
}, 20_000);
