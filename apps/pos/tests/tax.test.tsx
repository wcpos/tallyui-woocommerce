import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { StoreSettingsGate } from '../components/store-settings-gate';
import { useTillStoreSettings } from '../lib/sale/use-till-store-settings';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession, type Session } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/taxes/stores.json';
import classes from './fixtures/taxes/tax-classes.json';
import taxes from './fixtures/taxes/taxes.json';

const connector = createWooCommerceConnector();
const basket = [
  { ...products[0], tax_class: '', tax_status: 'taxable' },
  { ...products[0], id: 86, name: 'Croissant', price: '3.50', regular_price: '3.50', tax_class: 'reduced-rate', tax_status: 'taxable' },
  { ...products[0], id: 96, name: 'Tote Bag', price: '15.00', regular_price: '15.00', tax_class: 'zero-rate', tax_status: 'taxable' },
  { ...products[0], id: 90, name: 'Banana Bread', price: '4.25', regular_price: '4.25', tax_class: '', tax_status: 'none' },
];
let session: Session;
let inclusive: boolean;
let readTaxes: () => Response | Promise<Response>;
let fetchStub: ReturnType<typeof vi.fn<typeof fetch>>;

function Till({ currentSession = session }: { currentSession?: Session }) {
  const store = useTillStoreSettings(currentSession);
  const outbox = useOutbox();
  return <>
    {outbox.enabled && outbox.orders ? <span>Order store ready</span> : null}
    <StoreSettingsGate store={store}>{settings => <SaleScreen storeSettings={settings}
      connector={connector} currency="USD" products={basket} storeName={stores[0].name}
      cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />}</StoreSettingsGate>
    <PortalHost />
  </>;
}

function renderTill() {
  return render(<SessionProvider><OutboxProvider storage={getRxStorageMemory()}>
    <Till />
  </OutboxProvider></SessionProvider>);
}

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  session = {
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  };
  saveSession(session);
  inclusive = false;
  readTaxes = () => Response.json(taxes);
  fetchStub = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/stores')) return Response.json([
      { ...stores[0], prices_include_tax: inclusive ? 'yes' : 'no' },
    ]);
    if (url.pathname.endsWith('/status')) return Response.json({ capabilities: [] });
    if (url.pathname.endsWith('/taxes/classes')) return Response.json(classes);
    if (url.pathname.endsWith('/taxes')) return readTaxes();
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('matches WooCommerce order #136: tax 1.16 and total 32.91', async () => {
  renderTill();
  fireEvent.click(await screen.findByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  for (const name of ['Croissant', 'Tote Bag', 'Banana Bread']) fireEvent.click(screen.getByText(name));
  const footer = within(screen.getByTestId('cart-footer'));
  const taxMinor = footer.getAllByText(/^Tax /).reduce((sum, label) => {
    const amount = within(label.parentElement!).getByText(/^\$/).textContent!;
    return sum + Math.round(Number(amount.slice(1)) * 100);
  }, 0);
  expect(taxMinor).toBe(116);
  expect(within(footer.getByText('Total').parentElement!).getByText('$32.91')).not.toBeNull();
});

test('does not mount the sale while taxes are pending', async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  readTaxes = () => pending;
  renderTill();
  await waitFor(() => expect(fetchStub.mock.calls.some(([url]) => String(url).includes('/taxes?'))).toBe(true));
  expect(screen.getByText("Loading the store's tax settings…")).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
  expect(screen.queryByText('Espresso')).toBeNull();
  await act(async () => { release(Response.json(taxes)); });
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(await screen.findByText('Cash Tendered')).not.toBeNull();
});

test('a taxes failure blocks the sale until Retry succeeds', async () => {
  readTaxes = () => new Response(null, { status: 503 });
  renderTill();
  expect(await screen.findByText("Could not load the store's tax settings.")).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
  expect(screen.queryByText('Espresso')).toBeNull();
  readTaxes = () => Response.json(taxes);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(await screen.findByText('Cash Tendered')).not.toBeNull();
});

test.each(['Order discount', 'Discount'])('inclusive stores refuse %s before tender and allow its removal', async control => {
  inclusive = true;
  renderTill();
  fireEvent.click(await screen.findByText('Espresso'));
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText(control, { exact: true }));
  fireEvent.change(screen.getByLabelText('Discount value'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(await screen.findByText("Discounts can't be sold on a tax-inclusive store yet. Remove the discount to take payment.")).not.toBeNull();
  expect(screen.queryByText('Cash Tendered')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Complete sale' })).toBeNull();
  expect(fetchStub.mock.calls.filter(([url]) => String(url).includes('/push/'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /^Remove discount / }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(await screen.findByText('Cash Tendered')).not.toBeNull();
});

test('a token refresh does not re-resolve settings and Retry uses the latest token', async () => {
  readTaxes = () => new Response(null, { status: 503 });
  const view = render(<Till />);
  await screen.findByRole('button', { name: 'Retry' });
  const calls = fetchStub.mock.calls.length;
  const refreshed = { ...session, tokens: { ...session.tokens, accessToken: 'refreshed' } };
  await act(async () => { view.rerender(<Till currentSession={refreshed} />); });
  expect(fetchStub).toHaveBeenCalledTimes(calls);
  readTaxes = () => Response.json(taxes);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Espresso');
  for (const [, init] of fetchStub.mock.calls.slice(calls)) {
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer refreshed');
  }
});
