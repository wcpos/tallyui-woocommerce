import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { CASHIERS_KEY, saveSession, SESSION_KEY } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { StoreAccessDeniedError } from '../lib/catalogue/store-info';

const message = new StoreAccessDeniedError().message;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: {
      accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 86400,
      user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'Cashier' },
    },
  });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('unexpected fetch'); }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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

function Probe({ withSignOut }: { withSignOut: boolean }) {
  const { session, signOut } = useSession();
  if (!session) return <span data-testid="signed-out" />;
  return <CatalogueUnavailable message={message} onSignOut={withSignOut ? signOut : undefined} />;
}

test('Sign out leaves the error screen and keeps the till data that is not the session', async () => {
  const kept = { 'tallywoo.device_id': 'device-1', 'tallywoo.held-cart.cashier-b': '{"lines":[]}', [CASHIERS_KEY]: '{"x":[]}' };
  Object.entries(kept).forEach(([key, value]) => localStorage.setItem(key, value));
  render(<SessionProvider><Probe withSignOut /></SessionProvider>);
  await screen.findByText(message);
  await act(async () => { fireEvent.click(screen.getByTestId('catalogue-error-sign-out')); });
  expect(screen.getByTestId('signed-out')).not.toBeNull();
  expect(screen.queryByText(message)).toBeNull();
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  Object.entries(kept).forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));
});

test('without onSignOut there is no Sign out button', async () => {
  render(<SessionProvider><Probe withSignOut={false} /></SessionProvider>);
  await screen.findByText(message);
  expect(screen.queryByTestId('catalogue-error-sign-out')).toBeNull();
});
