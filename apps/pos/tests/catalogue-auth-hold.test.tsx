import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { saveSession, SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { CatalogueProvider, useCatalogue } from '../lib/catalogue/catalogue-context';
import { StoreAccessDeniedError } from '../lib/catalogue/store-info';

const mocks = vi.hoisted(() => ({ startCatalogue: vi.fn() }));
vi.mock('../lib/catalogue/start-catalogue', () => ({ startCatalogue: mocks.startCatalogue }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => ({ enabled: false }) }));

let session: Session;
let sessionApi: ReturnType<typeof useSession>;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession(session = {
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

/** Seeds an expired access token and answers its refresh with 'fresh' when the returned function is called. */
function seedExpiredSession(): () => Promise<void> {
  saveSession({ ...session, tokens: { ...session.tokens, expiresAt: Math.floor(Date.now() / 1000) - 60 } });
  let answer!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/auth/refresh')
    ? new Promise<Response>(done => { answer = done; }) : Promise.reject(new Error('unexpected fetch'))));
  return () => act(async () => { answer(Response.json({ access_token: 'fresh', expires_in: 86400 })); });
}

function Probe() {
  sessionApi = useSession();
  const { held } = sessionApi;
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

test('a start with the old token, refused after the refresh won, does not hold the fresh session', async () => {
  const resolveRefresh = seedExpiredSession();
  let refuseOld: (() => void) | undefined;
  mocks.startCatalogue.mockImplementation((started: Session) => new Promise((_resolve, reject) => {
    if (started.tokens.accessToken === 'access') refuseOld = () => reject(new SessionExpiredError());
  }));
  renderTill();
  await resolveRefresh();
  await waitFor(() => expect(sessionApi.session?.tokens.accessToken).toBe('fresh'));
  await act(async () => { refuseOld?.(); });
  await waitFor(() => expect(mocks.startCatalogue).toHaveBeenCalled());
  expect(screen.getByTestId('held').textContent).toBe('false');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
  expect(mocks.startCatalogue.mock.calls.map(([started]) => started.tokens.accessToken)).toEqual(['fresh']);
});

test('a hold for a token the session has moved past is ignored', async () => {
  const resolveRefresh = seedExpiredSession();
  mocks.startCatalogue.mockReturnValue(new Promise(() => {}));
  renderTill();
  await resolveRefresh();
  await waitFor(() => expect(sessionApi.session?.tokens.accessToken).toBe('fresh'));
  act(() => { sessionApi.hold('access'); });
  expect(screen.getByTestId('held').textContent).toBe('false');
  act(() => { sessionApi.hold('fresh'); });
  expect(screen.getByTestId('held').textContent).toBe('true');
});

test('a user without POS access is told so and not held', async () => {
  mocks.startCatalogue.mockRejectedValue(new StoreAccessDeniedError());
  renderTill();
  await waitFor(() => expect(screen.getByTestId('error').textContent).toBe(
    'This user cannot use the POS on this store. Ask a store manager for POS access, or sign out and sign in as another user.'));
  expect(screen.getByTestId('held').textContent).toBe('false');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
});

test('any other start failure keeps the session live and shows its message', async () => {
  mocks.startCatalogue.mockRejectedValue(new Error('stores request failed: 500'));
  renderTill();
  await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('stores request failed: 500'));
  expect(screen.getByTestId('held').textContent).toBe('false');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
});
