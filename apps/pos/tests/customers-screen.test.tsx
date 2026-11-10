import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { ConnectorUnauthorizedError, CustomerServiceError, type Customer } from '@tallyui/core';
import { CustomersScreen } from '../components/customers-screen';
import { CatalogueView } from '../components/catalogue-view';
import type { CustomerSource } from '../lib/customers/customer-source';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const gee: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid', phone: '123', company: 'Four Co' };
const ada: Customer = { id: '9', name: 'Ada Lovelace' };

function renderScreen(search = vi.fn<CustomerSource['search']>(), onBack = vi.fn()) {
  render(<CustomersScreen source={{ search, create: vi.fn<CustomerSource['create']>() }} onBack={onBack} />);
  return { search, onBack };
}

test('before a search it asks for one and calls nothing', () => {
  const { search } = renderScreen();
  expect(screen.getByRole('heading', { name: 'Customers' })).not.toBeNull();
  expect(screen.getByTestId('no-data-message-title').textContent).toBe('Search Customers');
  expect(screen.getByTestId('no-data-message-description').textContent).toBe('Type at least 2 characters of a name, email or phone.');
  expect(screen.queryByTestId('no-data-message-action')).toBeNull();
  expect(search).not.toHaveBeenCalled();
});

test('Search Customers asks the store after a pause with the trimmed text', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([gee, ada]));
  const box = screen.getByPlaceholderText('Search Customers');
  fireEvent.change(box, { target: { value: ' g' } });
  fireEvent.change(box, { target: { value: ' ge' } });
  fireEvent.change(box, { target: { value: ' gee ' } });
  const row = await screen.findByTestId('customers-row-7');
  expect(search.mock.calls).toEqual([['gee']]);
  for (const heading of ['Name', 'Email', 'Phone', 'Company']) expect(screen.getByText(heading)).not.toBeNull();
  for (const value of ['Gee Four', '123', 'Four Co']) expect(within(row).getByText(value)).not.toBeNull();
  expect(screen.getByTestId('customer-email-gee@example.invalid').textContent).toBe('gee@example.invalid');
  const row9 = screen.getByTestId('customers-row-9');
  expect(within(row9).getByText('Ada Lovelace')).not.toBeNull();
  expect(within(row9).queryByTestId(/^customer-email-/)).toBeNull();
});

test('one character does not search', async () => {
  const { search } = renderScreen();
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'g' } });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  expect(search).not.toHaveBeenCalled();
  expect(screen.getByTestId('no-data-message-title').textContent).toBe('Search Customers');
});

test('a narrow window lists name and email rows', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([gee]));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  const row = await screen.findByTestId('customers-row-7');
  expect(within(row).getByText('Gee Four')).not.toBeNull();
  expect(within(row).getByTestId('customer-email-gee@example.invalid')).not.toBeNull();
  expect(screen.queryByText('123')).toBeNull();
  expect(screen.queryByText('Four Co')).toBeNull();
  expect(screen.queryByText('Phone')).toBeNull();
});

test('while the store answers it says Searching…', async () => {
  let resolve!: (found: Customer[]) => void;
  renderScreen(vi.fn<CustomerSource['search']>().mockReturnValue(new Promise<Customer[]>(r => { resolve = r; })));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  expect((await screen.findByTestId('customers-searching')).textContent).toBe('Searching…');
  await act(async () => { resolve([gee]); });
  expect(screen.getByTestId('customers-row-7')).not.toBeNull();
  expect(screen.queryByTestId('customers-searching')).toBeNull();
});

test('a slower earlier search does not replace a later one', async () => {
  let resolveFirst!: (found: Customer[]) => void;
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockReturnValueOnce(new Promise<Customer[]>(r => { resolveFirst = r; }))
    .mockResolvedValueOnce([ada]));
  const box = screen.getByPlaceholderText('Search Customers');
  fireEvent.change(box, { target: { value: 'gee' } });
  await vi.waitFor(() => expect(search).toHaveBeenCalledOnce());
  fireEvent.change(box, { target: { value: 'ada' } });
  await screen.findByTestId('customers-row-9');
  await act(async () => { resolveFirst([gee]); });
  expect(screen.queryByTestId('customers-row-7')).toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
});

test('with nothing matching it says so and Clear search empties the box', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([]));
  const box = screen.getByPlaceholderText('Search Customers');
  fireEvent.change(box, { target: { value: 'zzz' } });
  await vi.waitFor(() => expect(screen.getByTestId('no-data-message-title').textContent).toBe('No customers match your search'));
  expect(screen.queryByTestId('no-data-message-description')).toBeNull();
  const clear = screen.getByTestId('no-data-message-action');
  expect(clear.textContent).toBe('Clear search');
  fireEvent.click(clear);
  expect((box as HTMLInputElement).value).toBe('');
  expect(screen.getByTestId('no-data-message-title').textContent).toBe('Search Customers');
  expect(search.mock.calls).toEqual([['zzz']]);
});

test.each([
  [new ConnectorUnauthorizedError('Unauthorized', 401), 'Sign in again to search customers'],
  [new CustomerServiceError('invalid', 'Bad search'), 'The store refused: Bad search'],
  [new CustomerServiceError('network', 'Offline'), "Could not reach the store's customers: Offline"],
])('a failed search says %s', async (cause, expected) => {
  renderScreen(vi.fn<CustomerSource['search']>().mockRejectedValueOnce(cause));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  expect((await screen.findByTestId('customers-error')).textContent).toBe(expected);
  expect(screen.queryByTestId(/^customers-row-/)).toBeNull();
});

test('Try again searches again', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([gee]));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  await screen.findByTestId('customers-error');
  fireEvent.click(screen.getByTestId('customers-retry'));
  await screen.findByTestId('customers-row-7');
  expect(screen.queryByTestId('customers-error')).toBeNull();
  expect(search.mock.calls).toEqual([['gee'], ['gee']]);
});

test('without a store it says so', () => {
  render(<CustomersScreen source={null} onBack={() => {}} />);
  expect(screen.getByTestId('customers-unavailable').textContent).toBe('Customers show once the store is connected.');
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
});

test('Back calls onBack', () => {
  const { onBack } = renderScreen();
  fireEvent.click(screen.getByTestId('customers-back'));
  expect(onBack).toHaveBeenCalledOnce();
});

test('CatalogueView exposes Customers after Orders only when an onOpenCustomers handler is supplied', () => {
  const props = { connector: createWooCommerceConnector(), currency: stores[0].currency, products,
    storeName: stores[0].name, cashierName: 'Paul', status: 'ready' as const, onSignOut: () => {} };
  const onOpenCustomers = vi.fn();
  const { rerender } = render(<CatalogueView {...props} onOpenOrders={() => {}} onOpenReports={() => {}} onOpenCustomers={onOpenCustomers} />);
  const buttons = screen.getAllByRole('button').map(button => button.textContent);
  const ordersIndex = buttons.indexOf('Orders');
  expect(ordersIndex).toBeGreaterThanOrEqual(0);
  expect(buttons[ordersIndex + 1]).toBe('Customers');
  expect(buttons[ordersIndex + 2]).toBe('Reports');
  fireEvent.click(screen.getByTestId('customers-navigation'));
  expect(onOpenCustomers).toHaveBeenCalledOnce();
  rerender(<CatalogueView {...props} />);
  expect(screen.queryByTestId('customers-navigation')).toBeNull();
});
