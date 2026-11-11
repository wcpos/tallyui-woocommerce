import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { ConnectorUnauthorizedError, CustomerServiceError, type Customer } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { CustomersScreen } from '../components/customers-screen';
import { CatalogueView } from '../components/catalogue-view';
import { Toaster } from '../components/toaster';
import { dismissToast } from '../lib/toast/toast';
import { CREATE_CUSTOMERS_DENIED } from '../lib/auth/capabilities';
import type { CustomerSource } from '../lib/customers/customer-source';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CARD_CLASSES, classesOf } from './classes-of';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  act(() => dismissToast());
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

const gee: Customer = { id: '7', name: 'Gee Four', firstName: 'Gee', lastName: 'Four', email: 'gee@example.invalid', phone: '123', company: 'Four Co' };
const ada: Customer = { id: '9', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace' };

function renderScreen(search = vi.fn<CustomerSource['search']>().mockResolvedValue([]), onBack = vi.fn(),
  { create = vi.fn<CustomerSource['create']>(), createBlockedReason }: { create?: Mock<CustomerSource['create']>; createBlockedReason?: string } = {}) {
  render(<><CustomersScreen source={{ search, create }} onBack={onBack} createBlockedReason={createBlockedReason} /><PortalHost /><Toaster /></>);
  return { search, onBack, create };
}

// The default list, search(''), delivers the rows on open; no typing needed.
async function findRows(search = vi.fn<CustomerSource['search']>().mockResolvedValue([gee, ada]), options = {}) {
  const rendered = renderScreen(search, vi.fn(), options);
  await screen.findByTestId('customers-body');
  return rendered;
}

const searchBox = () => screen.getByPlaceholderText('Search Customers');

test('on open it lists the store\'s default customers', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([gee, ada]));
  expect(screen.getByRole('heading', { name: 'Customers' })).not.toBeNull();
  expect(await screen.findByTestId('customers-row-7')).not.toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 2');
  expect(screen.queryByTestId('no-data-message')).toBeNull();
  expect(search.mock.calls).toEqual([['']]);
});

test('Search Customers asks the store after a pause with the trimmed text', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>(async q => q ? [gee, ada] : []));
  const box = searchBox();
  fireEvent.change(box, { target: { value: ' g' } });
  fireEvent.change(box, { target: { value: ' ge' } });
  fireEvent.change(box, { target: { value: ' gee ' } });
  const row = await screen.findByTestId('customers-row-7');
  expect(search.mock.calls).toEqual([[''], ['gee']]);
  for (const heading of ['First Name', 'Last Name', 'Email', 'Billing Address']) expect(screen.getByText(heading)).not.toBeNull();
  expect(screen.queryByText('Phone')).toBeNull();
  for (const value of ['GF', 'Gee', 'Four', 'Gee Four', 'Four Co']) expect(within(row).getByText(value)).not.toBeNull();
  expect(within(row).queryByText('123')).toBeNull();
  expect(screen.getByTestId('customer-email-gee@example.invalid').textContent).toBe('gee@example.invalid');
  const row9 = screen.getByTestId('customers-row-9');
  expect(within(row9).getByText('Ada Lovelace')).not.toBeNull();
  expect(within(row9).queryByTestId(/^customer-email-/)).toBeNull();
});

test('one character keeps the default list and does not search with it', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([gee, ada]));
  await screen.findByTestId('customers-row-7');
  fireEvent.change(searchBox(), { target: { value: 'g' } });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  expect(search.mock.calls).toEqual([['']]);
  expect(screen.getByTestId('customers-row-7')).not.toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 2');
});

test('two characters search and replace the rows; clearing the box goes back to the default list', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>(async q => q ? [ada] : [gee]));
  await screen.findByTestId('customers-row-7');
  fireEvent.change(searchBox(), { target: { value: 'ad' } });
  await screen.findByTestId('customers-row-9');
  expect(screen.queryByTestId('customers-row-7')).toBeNull();
  expect(search.mock.calls).toEqual([[''], ['ad']]);
  fireEvent.change(searchBox(), { target: { value: '' } });
  await screen.findByTestId('customers-row-7');
  expect(screen.queryByTestId('customers-row-9')).toBeNull();
  expect(search.mock.calls).toEqual([[''], ['ad'], ['']]);
});

test('an empty default list says No customers found without Clear search', async () => {
  renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([]));
  await vi.waitFor(() => expect(screen.getByTestId('no-data-message-title').textContent).toBe('No customers found'));
  expect(screen.queryByTestId('no-data-message-action')).toBeNull();
  expect(screen.queryByTestId('no-data-message-description')).toBeNull();
  expect(screen.queryByTestId('data-table-count')).toBeNull();
});

test('a failed default load says so and Try again loads it again', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([gee]));
  expect((await screen.findByTestId('customers-error')).textContent).toBe("Could not reach the store's customers: Offline");
  fireEvent.click(screen.getByTestId('customers-retry'));
  await screen.findByTestId('customers-row-7');
  expect(screen.queryByTestId('customers-error')).toBeNull();
  expect(search.mock.calls).toEqual([[''], ['']]);
});

test('a slow default list landing after a search does not replace the search results', async () => {
  let resolveDefault!: (found: Customer[]) => void;
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockReturnValueOnce(new Promise<Customer[]>(r => { resolveDefault = r; }))
    .mockResolvedValueOnce([ada]));
  fireEvent.change(searchBox(), { target: { value: 'ada' } });
  await screen.findByTestId('customers-row-9');
  await act(async () => { resolveDefault([gee]); });
  expect(screen.queryByTestId('customers-row-7')).toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
  expect(search.mock.calls).toEqual([[''], ['ada']]);
});

test('a slow default list failing after a search does not replace the search results', async () => {
  let rejectDefault!: (cause: Error) => void;
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockReturnValueOnce(new Promise<Customer[]>((_, reject) => { rejectDefault = reject; }))
    .mockResolvedValueOnce([ada]));
  fireEvent.change(searchBox(), { target: { value: 'ada' } });
  await screen.findByTestId('customers-row-9');
  await act(async () => { rejectDefault(new Error('Offline')); });
  expect(screen.queryByTestId('customers-error')).toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
  expect(search.mock.calls).toEqual([[''], ['ada']]);
});

test('closing Add Customer loads the list again', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockResolvedValueOnce([ada]).mockResolvedValueOnce([ada, gee]));
  await screen.findByTestId('customers-row-9');
  expect(screen.queryByTestId('customers-row-7')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add new customer' }));
  fireEvent.click(screen.getByTestId('customer-form-close'));
  await screen.findByTestId('customers-row-7');
  expect(search.mock.calls).toEqual([[''], ['']]);
});

test('a narrow window lists name and email rows', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([gee]));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  const row = await screen.findByTestId('customers-row-7');
  expect(within(row).getByText('Gee Four')).not.toBeNull();
  expect(within(row).getByTestId('customer-email-gee@example.invalid')).not.toBeNull();
  expect(within(row).getByText('GF')).not.toBeNull();
  expect(within(row).queryByRole('button', { name: 'Open customer' })).toBeNull();
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1');
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
    .mockResolvedValueOnce([])
    .mockReturnValueOnce(new Promise<Customer[]>(r => { resolveFirst = r; }))
    .mockResolvedValueOnce([ada]));
  const box = searchBox();
  fireEvent.change(box, { target: { value: 'gee' } });
  await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  fireEvent.change(box, { target: { value: 'ada' } });
  await screen.findByTestId('customers-row-9');
  await act(async () => { resolveFirst([gee]); });
  expect(screen.queryByTestId('customers-row-7')).toBeNull();
  expect(screen.getByTestId('customers-row-9')).not.toBeNull();
});

test('with nothing matching it says so and Clear search empties the box', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValue([]));
  const box = searchBox();
  fireEvent.change(box, { target: { value: 'zzz' } });
  await vi.waitFor(() => expect(screen.getByTestId('no-data-message-title').textContent).toBe('No customers match your search'));
  expect(screen.queryByTestId('no-data-message-description')).toBeNull();
  const clear = screen.getByTestId('no-data-message-action');
  expect(clear.textContent).toBe('Clear search');
  fireEvent.click(clear);
  expect((box as HTMLInputElement).value).toBe('');
  await vi.waitFor(() => expect(screen.getByTestId('no-data-message-title').textContent).toBe('No customers found'));
  expect(search.mock.calls).toEqual([[''], ['zzz'], ['']]);
});

test.each([
  [new ConnectorUnauthorizedError('Unauthorized', 401), 'Sign in again to search customers'],
  [new CustomerServiceError('invalid', 'Bad search'), 'The store refused: Bad search'],
  [new CustomerServiceError('network', 'Offline'), "Could not reach the store's customers: Offline"],
])('a failed search says %s', async (cause, expected) => {
  renderScreen(vi.fn<CustomerSource['search']>().mockResolvedValueOnce([]).mockRejectedValueOnce(cause));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  expect((await screen.findByTestId('customers-error')).textContent).toBe(expected);
  expect(screen.queryByTestId(/^customers-row-/)).toBeNull();
});

test('Try again searches again', async () => {
  const { search } = renderScreen(vi.fn<CustomerSource['search']>()
    .mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([gee]));
  fireEvent.change(searchBox(), { target: { value: 'gee' } });
  await screen.findByTestId('customers-error', {}, { timeout: 5000 });
  // React keeps the Clear search Pressable as Try again, and RNW sets its new onPress in a passive effect: under CI
  // load the error can show before that runs, and the click clears the box. The empty act waits a task, after it.
  await act(async () => {});
  fireEvent.click(screen.getByTestId('customers-retry'));
  await screen.findByTestId('customers-row-7', {}, { timeout: 5000 });
  expect(screen.queryByTestId('customers-error')).toBeNull();
  expect(search.mock.calls).toEqual([[''], ['gee'], ['gee']]);
}, 20_000);

test('without a store it says so', () => {
  render(<CustomersScreen source={null} onBack={() => {}} createBlockedReason={undefined} />);
  expect(screen.getByTestId('customers-unavailable').textContent).toBe('Customers show once the store is connected.');
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
  expect(screen.queryByTestId('customers-add-button')).toBeNull();
});

test('Back calls onBack', () => {
  const { onBack } = renderScreen();
  fireEvent.click(screen.getByTestId('customers-back'));
  expect(onBack).toHaveBeenCalledOnce();
});

test('rows sort by Last Name and a header press flips or moves the sort', async () => {
  const cy: Customer = { id: '11', name: 'Cy Brown', firstName: 'Cy', lastName: 'Brown', email: 'cy@example.invalid' };
  await findRows(vi.fn<CustomerSource['search']>().mockResolvedValue([ada, gee, cy]));
  const ids = () => screen.getAllByTestId(/^customers-row-/).map(r => r.getAttribute('data-testid'));
  expect(ids()).toEqual(['customers-row-11', 'customers-row-7', 'customers-row-9']);
  expect(screen.getByTestId('data-table-sort-last_name-asc')).not.toBeNull();
  fireEvent.click(screen.getByTestId('data-table-header-last_name'));
  expect(ids()).toEqual(['customers-row-9', 'customers-row-7', 'customers-row-11']);
  expect(screen.getByTestId('data-table-sort-last_name-desc')).not.toBeNull();
  fireEvent.click(screen.getByTestId('data-table-header-first_name'));
  expect(ids()).toEqual(['customers-row-9', 'customers-row-11', 'customers-row-7']);
  expect(screen.getByTestId('data-table-sort-first_name-asc')).not.toBeNull();
  expect(screen.queryByTestId('data-table-sort-last_name-desc')).toBeNull();
  expect(screen.queryByTestId('data-table-header-billing')).toBeNull();
});

test('found customers show how many are shown', async () => {
  await findRows();
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 2');
});

test('each row has a disabled Open customer button until customers can be edited', async () => {
  await findRows();
  const open = within(screen.getByTestId('customers-row-7')).getByRole('button', { name: 'Open customer' });
  expect(open.getAttribute('aria-disabled')).toBe('true');
});

test('Add new customer opens Add Customer, requires an email and saves', async () => {
  const create = vi.fn<CustomerSource['create']>().mockResolvedValue(gee);
  renderScreen(undefined, undefined, { create });
  fireEvent.click(screen.getByRole('button', { name: 'Add new customer' }));
  expect(screen.getByRole('heading', { name: 'Add Customer' })).not.toBeNull();
  expect(screen.queryByPlaceholderText('Street address')).toBeNull();
  const submit = () => fireEvent.click(within(screen.getByTestId('customer-form')).getByText('Add Customer'));
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: '   ' } });
  submit();
  expect(screen.getByTestId('customer-form-error').textContent).toBe('An email is required');
  expect(create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: ' gee@example.invalid ' } });
  fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: ' Gee ' } });
  fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: '  ' } });
  submit();
  await waitFor(() => expect(create).toHaveBeenCalledExactlyOnceWith({ email: 'gee@example.invalid', firstName: 'Gee' }));
  expect(within(await screen.findByTestId('success-toast')).getByText('Gee Four saved')).not.toBeNull();
  await waitFor(() => expect(screen.queryByTestId('customer-form')).toBeNull());
});

test('a failed save toasts Failed to save customer and keeps the form', async () => {
  const create = vi.fn<CustomerSource['create']>()
    .mockRejectedValueOnce(new CustomerServiceError('invalid', 'An account is already registered with your email address.'));
  renderScreen(undefined, undefined, { create });
  fireEvent.click(screen.getByRole('button', { name: 'Add new customer' }));
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
  fireEvent.click(within(screen.getByTestId('customer-form')).getByText('Add Customer'));
  const t = await screen.findByTestId('error-toast');
  expect(within(t).getByText('Failed to save customer')).not.toBeNull();
  expect(within(t).getByText('The store refused: An account is already registered with your email address.')).not.toBeNull();
  expect(screen.getByTestId('customer-form')).not.toBeNull();
  expect((screen.getByPlaceholderText('email@example.com') as HTMLInputElement).value).toBe('gee@example.invalid');
});

test('Cancel closes Add Customer without saving', () => {
  const { create } = renderScreen();
  fireEvent.click(screen.getByRole('button', { name: 'Add new customer' }));
  fireEvent.click(screen.getByTestId('customer-form-close'));
  expect(screen.queryByTestId('customer-form')).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test('without the create capability Add new customer is disabled and says why', () => {
  renderScreen(undefined, undefined, { createBlockedReason: CREATE_CUSTOMERS_DENIED });
  const add = screen.getByRole('button', { name: 'Add new customer' });
  expect(add.getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('customers-add-blocked').textContent).toBe(CREATE_CUSTOMERS_DENIED);
  fireEvent.click(add);
  expect(screen.queryByTestId('customer-form')).toBeNull();
  cleanup();
  renderScreen();
  expect(screen.queryByTestId('customers-add-blocked')).toBeNull();
});

test('the drawer lists Customers after Orders only when an onOpenCustomers handler is supplied', () => {
  const props = { connector: createWooCommerceConnector(), currency: stores[0].currency, products,
    storeName: stores[0].name, cashierName: 'Paul', status: 'ready' as const, onSignOut: () => {} };
  const onOpenCustomers = vi.fn();
  const { rerender } = render(<><CatalogueView {...props} onOpenOrders={() => {}} onOpenReports={() => {}} onOpenCustomers={onOpenCustomers} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  const items = screen.getAllByTestId(/^drawer-item-/).map(i => i.textContent);
  const ordersIndex = items.indexOf('Orders');
  expect(ordersIndex).toBeGreaterThanOrEqual(0);
  expect(items[ordersIndex + 1]).toBe('Customers');
  expect(items[ordersIndex + 2]).toBe('Reports');
  fireEvent.click(screen.getByTestId('drawer-item-customers'));
  expect(onOpenCustomers).toHaveBeenCalledOnce();
  rerender(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  expect(screen.queryByTestId('drawer-item-customers')).toBeNull();
});

test("at 1280 the table sits on v2's card, with the count under it", async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  await findRows();
  const surface = screen.getByTestId('customers-table-surface');
  expect(classesOf('customers-table-surface')).toEqual(expect.arrayContaining(CARD_CLASSES));
  expect(surface.contains(screen.getByTestId('customers-body'))).toBe(true);
  expect(surface.contains(screen.getByTestId('data-table-count'))).toBe(false);
});
