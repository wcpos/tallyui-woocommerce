import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Products from '../app/products';
import { StoreSettingsProvider } from '../lib/sale/store-settings-context';
import Coupons from '../app/coupons';
import Customers from '../app/customers';
import Support from '../app/support';
import Orders from '../app/orders';
import Reports from '../app/reports';
import SettingsLayoutRoute from '../app/settings/_layout';
import HealthLayoutRoute from '../app/health/_layout';
import HealthDatabase from '../app/health/database';
import HealthPerformance from '../app/health/performance';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), canGoBack: () => false, back: vi.fn(), dismissTo: vi.fn() },
  pathname: '/settings/general',
  catalogueAvailable: true,
  catalogue: {
    connector: {}, store: { name: 'Store', currency: 'USD', locale: 'en-US', calcTaxes: false },
    cashier: { known: true, granted: ['create_customers'] },
    coupons: {}, db: { products: {} }, parkedCarts: {}, receiptEmails: {},
    replication: { resume: vi.fn() }, couponReplication: { resume: vi.fn() },
    cadence: {}, syncCadence: {}, requestMetrics: {},
  },
}));

vi.mock('../components/session-hold-banner', () => ({ SessionHoldBanner: () => <span data-testid="hold-stub" /> }));
vi.mock('expo-router', () => ({
  Redirect: () => null, Slot: () => null,
  useRouter: () => mocks.router, usePathname: () => mocks.pathname,
}));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({
    ready: true,
    session: {
      site: { name: 'Store', home: 'https://shop.example' },
      tokens: { user: { id: 2, displayName: 'Cashier' } },
    },
  }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({
    catalogue: mocks.catalogueAvailable ? mocks.catalogue : null,
    products: [], error: null, status: 'ready', notice: undefined,
  }),
}));
vi.mock('../lib/auth/request-context', () => ({ useRequestContext: () => ({}) }));
vi.mock('../lib/sale/use-till-store-settings', () => ({ useTillStoreSettings: () => ({ state: 'loading' }) }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => ({ enabled: false }) }));
vi.mock('../lib/customers/customer-source', () => ({ customerSource: () => null }));
vi.mock('../lib/orders/order-history', () => ({ orderHistorySource: () => null }));
vi.mock('../lib/layout/wide', () => ({ useIsWide: () => true }));
vi.mock('../lib/logs/unread-errors', () => ({ useUnreadLogsCount: () => 0 }));
vi.mock('../components/products-screen', () => ({ ProductsScreen: () => null }));
vi.mock('../components/coupons-screen', () => ({ CouponsScreen: () => null }));
vi.mock('../components/customers-screen', () => ({ CustomersScreen: () => null }));
vi.mock('../components/support-screen', () => ({ SupportScreen: () => null }));
vi.mock('../components/orders-screen', () => ({ OrdersScreen: () => null }));
vi.mock('../components/reports-screen', () => ({ ReportsScreen: () => null }));
vi.mock('../components/health-screen', () => ({ HealthScreen: () => null }));
vi.mock('../components/performance-screen', () => ({ PerformanceScreen: () => null }));
vi.mock('../components/performance-sync', () => ({ PerformanceSync: () => null }));

afterEach(() => { cleanup(); mocks.catalogueAvailable = true; mocks.pathname = '/settings/general'; });

test.each([
  ['Products', Products], ['Coupons', Coupons], ['Customers', Customers],
  ['Support', Support], ['Orders', Orders], ['Reports', Reports],
] as const)('%s renders the held-session banner once with a catalogue', (_name, Route) => {
  render(<Route />, { wrapper: StoreSettingsProvider });
  expect(screen.getAllByTestId('hold-stub')).toHaveLength(1);
});

test.each([
  ['Products', Products], ['Coupons', Coupons], ['Customers', Customers],
] as const)('%s renders the held-session banner once without a catalogue', (_name, Route) => {
  mocks.catalogueAvailable = false;
  render(<Route />, { wrapper: StoreSettingsProvider });
  expect(screen.getAllByTestId('hold-stub')).toHaveLength(1);
});

test('Settings renders the held-session banner once before its navigation', () => {
  render(<SettingsLayoutRoute />);
  expect(screen.getAllByTestId('hold-stub')).toHaveLength(1);
  expect(screen.getByTestId('hold-stub').compareDocumentPosition(screen.getByTestId('settings-navigation'))
    & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('Store health renders the held-session banner once across its layout and pages', () => {
  mocks.pathname = '/health/database';
  render(<><HealthLayoutRoute /><HealthDatabase /><HealthPerformance /></>);
  expect(screen.getAllByTestId('hold-stub')).toHaveLength(1);
});
