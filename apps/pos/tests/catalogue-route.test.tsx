// The catalogue route's wiring of CatalogueUnavailable: Sign out only on a failed start, never while connecting.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Catalogue from '../app/catalogue';

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    catalogueState: {} as { catalogue: null; error: string | undefined },
    signOut: vi.fn(() => { calls.push('signOut'); }),
    router: {
      replace: vi.fn((href: string) => { calls.push(`replace:${href}`); }),
      push: vi.fn(),
      canGoBack: () => false,
      back: vi.fn(),
    },
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => mocks.router,
  Redirect: () => <span data-testid="redirect" />,
}));

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
    ready: true,
    signOut: mocks.signOut,
    cashiers: [],
    switchCashier: vi.fn(),
    removeCashier: vi.fn(),
    startAddCashier: vi.fn(),
  }),
}));

vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ products: [], status: undefined, notice: undefined, ...mocks.catalogueState }),
}));

vi.mock('../lib/sale/use-till-store-settings', () => ({
  useTillStoreSettings: () => ({ status: 'loading' }),
}));

vi.mock('../components/session-hold-banner', () => ({
  SessionHoldBanner: () => null,
}));

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.signOut.mockClear();
  mocks.router.replace.mockClear();
});

afterEach(() => { cleanup(); });

test('a failed start shows the error with Sign out, which signs out then goes to /connect', async () => {
  const message = 'This user cannot use the POS on this store. Ask the store owner for access.';
  mocks.catalogueState = { catalogue: null, error: message };
  render(<Catalogue />);
  expect(screen.getByText(message)).not.toBeNull();
  const button = screen.getByTestId('catalogue-error-sign-out');
  await act(async () => { fireEvent.click(button); });
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
  expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  expect(mocks.router.replace).toHaveBeenCalledWith('/connect');
  expect(mocks.calls).toEqual(['signOut', 'replace:/connect']);
});

test('while connecting the notice shows with no Sign out button', () => {
  mocks.catalogueState = { catalogue: null, error: undefined };
  render(<Catalogue />);
  expect(screen.getByText('Connecting to Store…')).not.toBeNull();
  expect(screen.queryByTestId('catalogue-error-sign-out')).toBeNull();
});
