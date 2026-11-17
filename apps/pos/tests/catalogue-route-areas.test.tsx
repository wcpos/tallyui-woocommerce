import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Catalogue from '../app/catalogue';
import type { SaleScreenProps } from '../components/sale-screen';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), canGoBack: () => false, back: vi.fn() },
  props: {} as SaleScreenProps,
}));

vi.mock('expo-router', () => ({ useRouter: () => mocks.router, Redirect: () => <span data-testid="redirect" /> }));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({
    session: {
      site: {
        name: 'Store', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
        wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/',
      },
      tokens: {
        accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 86400,
        user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'Cashier' },
      },
    },
    ready: true, signOut: vi.fn(), cashiers: [], switchCashier: vi.fn(), removeCashier: vi.fn(), startAddCashier: vi.fn(),
  }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({
    products: [], status: 'ready', notice: undefined,
    catalogue: {
      connector: {}, store: { name: 'Store', currency: 'USD', locale: 'en-US' },
      coupons: {}, db: { products: {} }, replication: {},
    },
  }),
}));
vi.mock('../lib/sale/use-till-store-settings', () => ({ useTillStoreSettings: () => ({ state: 'ready', settings: {} }) }));
vi.mock('../components/session-hold-banner', () => ({ SessionHoldBanner: () => null }));
vi.mock('../lib/auth/request-context', () => ({ useRequestContext: () => ({}) }));
vi.mock('../lib/customers/customer-source', () => ({ customerSource: () => null }));
vi.mock('../lib/receipts/receipt-mailer', () => ({ receiptMailer: () => null }));
vi.mock('../lib/customers/default-customer', () => ({
  useDefaultCustomerSetting: () => [undefined], useDefaultCustomer: () => undefined,
}));
vi.mock('../components/sale-screen', () => ({
  SaleScreen: (props: SaleScreenProps) => { mocks.props = props; return null; },
}));

afterEach(() => { cleanup(); });

test("the till's drawer opens Products at /products and Coupons at /coupons", () => {
  render(<Catalogue />);
  mocks.props.onOpenProducts!();
  mocks.props.onOpenCoupons!();
  mocks.props.onOpenOrders!();
  expect(mocks.router.push.mock.calls).toEqual([['/products'], ['/coupons'], ['/orders']]);
});
