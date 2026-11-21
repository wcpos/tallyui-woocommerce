// H4b: one store-settings fetch per site for every screen, and the store's own money format for every components
// money display (v2 hooks/use-currency-format.tsx:21-60).
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ChangeDisplay } from '@tallyui/components';
import type { Money, StoreSettings } from '@tallyui/core';
import Catalogue from '../app/catalogue';
import TaxSettingsRoute from '../app/settings/tax';
import { StoreSettingsProvider, useTillStoreSettingsState } from '../lib/sale/store-settings-context';
import { useFormatStoreMoney, useStoreMoney } from '../lib/money/store-money';
import { noTaxSettings } from './fixtures/store-settings';

const euroStore: StoreSettings = {
  ...noTaxSettings, currency: 'EUR',
  moneyFormat: { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '€' },
};

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  storeSettings: vi.fn(),
  createConnector: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn(), canGoBack: () => false, back: vi.fn() },
}));

vi.mock('@tallyui/connector-woocommerce', async (original) => ({
  ...await original<typeof import('@tallyui/connector-woocommerce')>(),
  createWooCommerceConnector: mocks.createConnector,
}));
vi.mock('expo-router', () => ({
  useRouter: () => mocks.router, usePathname: () => '/catalogue', Redirect: () => <span data-testid="redirect" />,
}));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({
    session: mocks.session, ready: true,
    signOut: vi.fn(), cashiers: [], switchCashier: vi.fn(), removeCashier: vi.fn(), startAddCashier: vi.fn(),
  }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({
    products: [], status: 'ready', notice: undefined, error: undefined,
    catalogue: {
      connector: {}, store: { name: 'Store', currency: 'EUR', locale: 'en-US' },
      coupons: {}, db: { products: {} }, replication: {},
    },
  }),
}));
vi.mock('../components/session-hold-banner', () => ({ SessionHoldBanner: () => null }));
vi.mock('../lib/auth/request-context', () => ({ useRequestContext: () => ({}) }));
vi.mock('../lib/customers/customer-source', () => ({ customerSource: () => null }));
vi.mock('../lib/receipts/receipt-mailer', () => ({ receiptMailer: () => null }));
vi.mock('../lib/customers/default-customer', () => ({
  useDefaultCustomerSetting: () => [undefined], useDefaultCustomer: () => undefined,
}));
vi.mock('../components/sale-screen', () => ({ SaleScreen: () => <span data-testid="sale-screen" /> }));
vi.mock('../components/settings/tax-settings', () => ({ TaxSettings: () => <span data-testid="tax-settings" /> }));

const fetchStub = vi.fn<typeof fetch>(async () => { throw new Error('no network in this test'); });

beforeEach(() => {
  mocks.session = {
    site: {
      name: 'Store', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
      wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/',
    },
    tokens: {
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 86400,
      user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'Cashier' },
    },
  };
  mocks.storeSettings.mockReset().mockResolvedValue(euroStore);
  mocks.createConnector.mockReset().mockImplementation(() => ({
    id: 'woocommerce', auth: { getHeaders: () => ({}) }, storeSettings: mocks.storeSettings,
  }));
  fetchStub.mockClear();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function StoreState() {
  return <span data-testid="store-state">{useTillStoreSettingsState().state}</span>;
}

test('a components money display reads in the store format once its settings are in', async () => {
  render(<StoreSettingsProvider><StoreState /><ChangeDisplay change={{ amount: 123450, currency: 'EUR' }} /></StoreSettingsProvider>);
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  expect(screen.getByText(/^1\.234,50\s€$/).textContent).toBe('1.234,50 €');
});

test('without a session nothing is fetched and the state is loading', async () => {
  mocks.session = null;
  render(<StoreSettingsProvider><StoreState /><ChangeDisplay change={{ amount: 123450, currency: 'EUR' }} /></StoreSettingsProvider>);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(screen.getByTestId('store-state').textContent).toBe('loading');
  expect(mocks.createConnector).toHaveBeenCalledTimes(0);
  expect(mocks.storeSettings).toHaveBeenCalledTimes(0);
  expect(fetchStub).toHaveBeenCalledTimes(0);
  // No store format: the display falls back to Intl, as outside any provider.
  expect(screen.queryByText(/1\.234,50/)).toBeNull();
});

test('catalogue and the tax settings route share one store-settings fetch', async () => {
  render(<StoreSettingsProvider><Catalogue /><TaxSettingsRoute /></StoreSettingsProvider>);
  await screen.findByTestId('sale-screen');
  await screen.findByTestId('tax-settings');
  expect(mocks.storeSettings).toHaveBeenCalledTimes(1);
});

// Shows `money` the way an app money display does, and logs what every render saw.
function MoneyProbe({ money, log }: { money: Money; log?: string[] }) {
  const state = useTillStoreSettingsState().state;
  const symbol = useStoreMoney()?.format.symbol ?? 'none';
  const shown = useFormatStoreMoney()(money) ?? '';
  log?.push(`${state}:${symbol}`);
  return <span data-testid="probe">{shown}</span>;
}

const probe = () => screen.getByTestId('probe').textContent;

// Intl (and so core's minorUnitDigits) gives HUF 0 places, not ISO 4217's 2, so a HUF store asking for 0 is already at
// its currency's places; EUR (2 places) asking for 0 is the case the clamp exists for.
test('(i) a store asking fewer places than its currency has shows the currency\'s places', async () => {
  mocks.storeSettings.mockResolvedValue({ ...euroStore, moneyFormat: { ...euroStore.moneyFormat!, decimals: 0 } });
  render(<StoreSettingsProvider><StoreState /><MoneyProbe money={{ amount: 50, currency: 'EUR' }} /><ChangeDisplay change={{ amount: 123450, currency: 'EUR' }} /></StoreSettingsProvider>);
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  expect(probe()).toBe('0,50 €');
  // The components get the same clamped format.
  expect(screen.getByText(/^1\.234,50\s€$/).textContent).toBe('1.234,50 €');
});

test('(i) a currency Intl gives no places stays at none', async () => {
  mocks.storeSettings.mockResolvedValue({
    ...noTaxSettings, currency: 'HUF',
    moneyFormat: { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 0, symbol: 'Ft' },
  } satisfies StoreSettings);
  render(<StoreSettingsProvider><StoreState /><MoneyProbe money={{ amount: 1250, currency: 'HUF' }} /></StoreSettingsProvider>);
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  expect(probe()).toBe('1.250 Ft');
});

test('(i) a store asking more places than its currency has keeps them', async () => {
  mocks.storeSettings.mockResolvedValue({
    ...noTaxSettings, currency: 'USD',
    moneyFormat: { position: 'left', thousandSeparator: ',', decimalSeparator: '.', decimals: 3, symbol: '$' },
  } satisfies StoreSettings);
  render(<StoreSettingsProvider><StoreState /><MoneyProbe money={{ amount: 1234, currency: 'USD' }} /></StoreSettingsProvider>);
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  expect(probe()).toMatch(/^\$12\.\d{3}$/);
});

const krStore: StoreSettings = {
  ...noTaxSettings, currency: 'SEK',
  moneyFormat: { position: 'right_space', thousandSeparator: ' ', decimalSeparator: ',', decimals: 2, symbol: 'kr' },
};

test('(k) after a site switch no render shows the previous site\'s format: loading, then the new one', async () => {
  const log: string[] = [];
  const tree = () => <StoreSettingsProvider><MoneyProbe money={{ amount: 1250, currency: 'EUR' }} log={log} /></StoreSettingsProvider>;
  const { rerender } = render(tree());
  await waitFor(() => { expect(log.at(-1)).toBe('ready:€'); });
  let resolve: (settings: StoreSettings) => void = () => {};
  mocks.storeSettings.mockImplementation(() => new Promise<StoreSettings>(done => { resolve = done; }));
  const before = log.length;
  const session = mocks.session as { site: Record<string, string>; tokens: unknown };
  mocks.session = { ...session, site: { ...session.site, home: 'https://other.example', wcposApiUrl: 'https://other.example/wp-json/wcpos/v2' } };
  act(() => { rerender(tree()); });
  await waitFor(() => { expect(mocks.storeSettings).toHaveBeenCalledTimes(2); });
  expect(log.slice(before).length).toBeGreaterThan(0);
  expect(log.slice(before).every(entry => entry === 'loading:none')).toBe(true);
  await act(async () => { resolve(krStore); });
  await waitFor(() => { expect(log.at(-1)).toBe('ready:kr'); });
  expect(log.slice(before).filter(entry => entry !== 'loading:none' && entry !== 'ready:kr')).toEqual([]);
});

test('(k) a token-only change fetches the store settings no second time', async () => {
  const tree = () => <StoreSettingsProvider><StoreState /><MoneyProbe money={{ amount: 1250, currency: 'EUR' }} /></StoreSettingsProvider>;
  const { rerender } = render(tree());
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  const session = mocks.session as { site: unknown; tokens: Record<string, unknown> };
  mocks.session = { ...session, tokens: { ...session.tokens, accessToken: 'access-2' } };
  act(() => { rerender(tree()); });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(mocks.storeSettings).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('store-state').textContent).toBe('ready');
  expect(probe()).toBe('12,50 €');
});

test('(k) sign-out then sign-in to the same site fetches the store settings again', async () => {
  const tree = () => <StoreSettingsProvider><StoreState /><MoneyProbe money={{ amount: 1250, currency: 'EUR' }} /></StoreSettingsProvider>;
  const { rerender } = render(tree());
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  const session = mocks.session;
  mocks.session = null;
  act(() => { rerender(tree()); });
  expect(screen.getByTestId('store-state').textContent).toBe('loading');
  expect(probe()).not.toBe('12,50 €');
  mocks.session = session;
  act(() => { rerender(tree()); });
  await waitFor(() => { expect(mocks.storeSettings).toHaveBeenCalledTimes(2); });
  await waitFor(() => { expect(screen.getByTestId('store-state').textContent).toBe('ready'); });
  expect(probe()).toBe('12,50 €');
});
