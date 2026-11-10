import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { saveSession, SessionExpiredError } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { CatalogueProvider, useCatalogue } from '../lib/catalogue/catalogue-context';

const mocks = vi.hoisted(() => ({ startCatalogue: vi.fn() }));
vi.mock('../lib/catalogue/start-catalogue', () => ({ startCatalogue: mocks.startCatalogue }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => ({ enabled: false }) }));

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mocks.startCatalogue.mockReset();
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

function Probe() {
  const { held } = useSession();
  const { error } = useCatalogue();
  return <>
    <span data-testid="held">{String(held)}</span>
    <span data-testid="error">{error ?? ''}</span>
  </>;
}

function renderTill() {
  return render(
    <SessionProvider>
      <CatalogueProvider>
        <Probe />
        <SessionHoldBanner />
      </CatalogueProvider>
    </SessionProvider>,
  );
}

test('a start the store refuses holds the session and offers Log in', async () => {
  mocks.startCatalogue.mockRejectedValue(new SessionExpiredError());
  renderTill();
  await waitFor(() => expect(screen.getByTestId('held').textContent).toBe('true'));
  expect(screen.getByTestId('session-hold-banner-title').textContent).toBe('Session expired');
  expect(screen.getByTestId('error').textContent)
    .toBe('The store did not accept this sign-in. Log in again to load the catalogue.');
  expect(fetch).not.toHaveBeenCalled();
});

test('the 5-minute refresh keeps a hold the store set at start', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mocks.startCatalogue.mockRejectedValue(new SessionExpiredError());
  renderTill();
  await waitFor(() => expect(screen.getByTestId('held').textContent).toBe('true'));
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000); });
  expect(screen.getByTestId('held').textContent).toBe('true');
  expect(screen.getByTestId('session-hold-banner-title').textContent).toBe('Session expired');
});

test('any other start failure keeps the session live and shows its message', async () => {
  mocks.startCatalogue.mockRejectedValue(new Error('stores request failed: 500'));
  renderTill();
  await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('stores request failed: 500'));
  expect(screen.getByTestId('held').textContent).toBe('false');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
});
