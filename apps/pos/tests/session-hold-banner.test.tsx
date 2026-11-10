import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, assert, beforeEach, expect, test, vi } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { SessionHoldBanner, sessionHoldCopy } from '../components/session-hold-banner';
import { loadSession, PENDING_KEY, saveSession } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';

let session: Session;
let sessionApi: ReturnType<typeof useSession>;
let outboxApi: ReturnType<typeof useOutbox>;
let send: ReturnType<typeof vi.fn<CommandTransport<OrderCreateEnvelope>['send']>>;
let answer!: (response: Response) => void;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  const home = `https://shop.example/${crypto.randomUUID()}`;
  session = {
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: {
      accessToken: 'old-access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 60,
      user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'Cashier' },
    },
  };
  saveSession(session);
  send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async () => ({ kind: 'retry', reason: 'network' }));
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { answer = done; })));
});

afterEach(() => {
  cleanup();
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
  sessionApi = useSession();
  outboxApi = useOutbox();
  return <>
    {outboxApi.enabled && outboxApi.orders && <span>Order store ready</span>}
    {outboxApi.enabled && <span>{`pending ${outboxApi.state.pending}`}</span>}
  </>;
}

function renderTill() {
  return render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <Probe />
        <SessionHoldBanner />
      </OutboxProvider>
    </SessionProvider>,
  );
}

const pendingOrder: PosOrder = {
  id: 'sale-1', createdAt: '2026-10-07T07:00:00.000Z', updatedAt: '2026-10-07T07:00:00.000Z',
  currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
  subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
  taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
  syncStatus: 'pending',
};

test.each([
  [{ held: false, authRequired: false, salesWaiting: 2 }, null],
  [{ held: true, authRequired: false, salesWaiting: 0 }, { title: 'Session expired', description: 'Sign in to reconnect to the store.' }],
  [{ held: false, authRequired: true, salesWaiting: 0 }, { title: 'Session expired', description: 'Sign in to reconnect to the store.' }],
  [{ held: true, authRequired: false, salesWaiting: 1 }, { title: '1 sale waiting to sync', description: 'Log in to continue.' }],
  [{ held: false, authRequired: true, salesWaiting: 2 }, { title: '2 sales waiting to sync', description: 'Log in to continue.' }],
] as const)('sessionHoldCopy %#', (hold, expected) => {
  expect(sessionHoldCopy(hold)).toEqual(expected);
});

test('shows nothing while the session is live, even with sales waiting', async () => {
  saveSession({ ...session, tokens: { ...session.tokens, expiresAt: Math.floor(Date.now() / 1000) + 86400 } });
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => {
    assert(outboxApi.enabled);
    await outboxApi.orders!.insert(pendingOrder);
  });
  await screen.findByText('pending 1');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
}, 20_000);

test('holds an expired session and keeps its unsent sale queued', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => {
    assert(outboxApi.enabled);
    await outboxApi.orders!.insert(pendingOrder);
  });
  await screen.findByText('pending 1');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await waitFor(() => expect(screen.getByTestId('session-hold-banner-title').textContent).toBe('1 sale waiting to sync'));
  expect(screen.getByTestId('session-hold-banner-description').textContent).toBe('Log in to continue.');
  expect(sessionApi.held).toBe(true);
  expect(sessionApi.session).toEqual(session);
  expect(loadSession()).toEqual(session);
  expect(outboxApi.enabled).toBe(true);
  assert(outboxApi.enabled);
  expect((await outboxApi.orders!.findOne('sale-1').exec())?.syncStatus).toBe('pending');
  expect(screen.getByText('pending 1')).not.toBeNull();
}, 20_000);

test('shows Session expired when no sale is waiting', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await waitFor(() => expect(screen.getByTestId('session-hold-banner-title').textContent).toBe('Session expired'));
  expect(screen.getByTestId('session-hold-banner-description').textContent).toBe('Sign in to reconnect to the store.');
  expect(loadSession()).toEqual(session);
}, 20_000);

test('Log in signs in again for the held site and the new session ends the hold, keeping the sale', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => {
    assert(outboxApi.enabled);
    await outboxApi.orders!.insert(pendingOrder);
  });
  await screen.findByText('pending 1');
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await waitFor(() => expect(screen.getByTestId('session-hold-banner-title').textContent).toBe('1 sale waiting to sync'));
  fireEvent.click(screen.getByTestId('session-hold-login'));
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)!);
  expect(pending.site).toEqual(session.site);
  expect(pending.mode).toBeUndefined();
  expect(pending.state).toEqual(expect.any(String));
  expect(pending.state.length).toBeGreaterThan(0);
  act(() => {
    sessionApi.completeSignIn(`?state=${pending.state}&access_token=renewed&refresh_token=refresh-2&expires_at=${session.tokens.expiresAt + 86400}&id=2&uuid=${session.tokens.user.uuid}&display_name=Cashier`);
  });
  await waitFor(() => expect(screen.queryByTestId('session-hold-banner')).toBeNull());
  expect(sessionApi.held).toBe(false);
  expect(loadSession()?.tokens.accessToken).toBe('renewed');
  assert(outboxApi.enabled);
  expect((await outboxApi.orders!.findOne('sale-1').exec())?.syncStatus).toBe('pending');
}, 20_000);
