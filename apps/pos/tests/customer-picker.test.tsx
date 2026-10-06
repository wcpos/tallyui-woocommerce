import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { Customer, OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { CustomerPicker } from '../components/customer-picker';
import { SaleScreen } from '../components/sale-screen';
import type { CustomerSource } from '../lib/customers/customer-source';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const gee: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid', phone: '123' };
const summary = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const search = vi.fn<CustomerSource['search']>();
const create = vi.fn<CustomerSource['create']>();
const source = { search, create };
const onChange = vi.fn();
const saleProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2', status: 'ready' as const, onSignOut: () => {},
};

beforeEach(() => {
  search.mockReset().mockResolvedValue([gee]);
  create.mockReset().mockResolvedValue(gee);
  onChange.mockReset();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function openPicker(customer: Customer | null = null) {
  render(<CustomerPicker source={source} customer={customer} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Change customer' }));
}

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Search name, email or phone'), { target: { value } });
}

test('searches from two trimmed characters and attaches the selected summary', async () => {
  openPicker();
  expect(screen.getAllByPlaceholderText('Search name, email or phone')).toHaveLength(1);
  typeQuery('g');
  expect(search).not.toHaveBeenCalled();
  typeQuery(' g ');
  expect(search).not.toHaveBeenCalled();
  typeQuery('gee');
  expect(search).toHaveBeenCalledWith('gee');
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(summary);
  expect(screen.queryByPlaceholderText('Search name, email or phone')).toBeNull();
});

test('only shows results for the latest query when answers arrive out of order', async () => {
  let resolveFirst!: (customers: Customer[]) => void;
  search.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
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

test('a short query clears results and invalidates a pending search', async () => {
  let resolvePending!: (customers: Customer[]) => void;
  openPicker();
  typeQuery('gee');
  await screen.findByLabelText('Gee Four, gee@example.invalid');
  typeQuery('g');
  expect(screen.queryByLabelText('Gee Four, gee@example.invalid')).toBeNull();
  search.mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve; }));
  typeQuery('four');
  typeQuery('');
  await act(async () => { resolvePending([gee]); });
  expect(screen.queryByLabelText('Gee Four, gee@example.invalid')).toBeNull();
  expect(search).toHaveBeenCalledTimes(2);
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
  expect(screen.getByText('Customer: Gee Four')).not.toBeNull();
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
  search.mockRejectedValueOnce(new ConnectorUnauthorizedError('Private error detail', 401));
  openPicker(gee);
  typeQuery('gee');
  expect(await screen.findByText('Sign in again to search customers')).not.toBeNull();
  expect(screen.queryByText(/Private error detail/)).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test('Guest clears the attached customer', () => {
  render(<CustomerPicker source={source} customer={gee} onChange={onChange} />);
  expect(screen.getByText('Customer: Gee Four')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Guest' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
});

test.each([undefined, null])('no customer controls without a source (%s)', customers => {
  render(<SaleScreen {...saleProps} customers={customers} />);
  expect(screen.queryByRole('button', { name: 'Change customer' })).toBeNull();
  expect(screen.queryByText('Guest')).toBeNull();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test('sends the picked customer with a cash sale, then sends a guest after New sale', async () => {
  const data = new Map<string, string>();
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
        <SaleScreen {...saleProps} customers={source} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  expect(screen.getByText('Guest')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Change customer' }));
  typeQuery('gee');
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(screen.getByText('Customer: Gee Four')).not.toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(within(screen.getByRole('button', { name: 'Complete sale' }).parentElement!).getByRole('textbox'), { target: { value: '3.00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(within(screen.getByRole('button', { name: 'Complete sale' }).parentElement!).getByRole('textbox'), { target: { value: '3.00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(2);
  expect(envelopes[1].type).toBe('order.create');
  expect(envelopes[1].version).toBe(3);
  expect(envelopes[1].payload.customer).toBeNull();
  await screen.findByText('Sales are up to date.');
}, 20_000);
