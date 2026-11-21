// H4b: one store-settings fetch per site for every screen, and the store's own money format for every components
// money display (v2 hooks/use-currency-format.tsx:21-60).
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ChangeDisplay } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import Catalogue from '../app/catalogue';
import TaxSettingsRoute from '../app/settings/tax';
import { StoreSettingsProvider, useTillStoreSettingsState } from '../lib/sale/store-settings-context';
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
