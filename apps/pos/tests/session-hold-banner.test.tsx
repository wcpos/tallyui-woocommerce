import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, assert, beforeEach, expect, test, vi } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { SessionHoldBanner, sessionHoldCopy } from '../components/session-hold-banner';
import { loadSession, PENDING_KEY, saveSession, SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { setBeforeLeave } from '../lib/sale/before-leave';

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
  setBeforeLeave(null);
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
  await act(async () => { fireEvent.click(screen.getByTestId('session-hold-login')); });
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)!);
  expect(pending.site).toEqual(session.site);
  expect(pending.mode).toBe('reauth');
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

test('Log in is refused with the reason and does not redirect when leaving is refused', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await screen.findByTestId('session-hold-login');
  const assign = vi.fn();
  vi.stubGlobal('window', new Proxy(window, {
    get: (target, key) => key === 'location' ? { ...target.location, assign } : Reflect.get(target, key),
  }));
  setBeforeLeave(async () => 'Finish or cancel the payment first.');
  await act(async () => { fireEvent.click(screen.getByTestId('session-hold-login')); });
  expect(screen.getByTestId('session-hold-refusal').textContent).toBe('Finish or cancel the payment first.');
  expect(assign).not.toHaveBeenCalled();
  setBeforeLeave(null);
}, 20_000);

test('Log in shows a thrown error and can be pressed again', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await screen.findByTestId('session-hold-login');
  const assign = vi.fn();
  vi.stubGlobal('window', new Proxy(window, {
    get: (target, key) => key === 'location' ? { ...target.location, assign } : Reflect.get(target, key),
  }));
  const handler = vi.fn(async () => { throw new Error('Park failed'); });
  setBeforeLeave(handler);
  await act(async () => { fireEvent.click(screen.getByTestId('session-hold-login')); });
  expect(screen.getByTestId('session-hold-refusal').textContent).toBe('Park failed');
  expect(assign).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByTestId('session-hold-login')); });
  expect(handler).toHaveBeenCalledTimes(2);
  expect(assign).not.toHaveBeenCalled();
}, 20_000);

test('a re-auth that returns as another user keeps the held cashier in the roster', async () => {
  renderTill();
  await screen.findByText('Order store ready');
  await act(async () => { answer(new Response(null, { status: 401 })); });
  await screen.findByTestId('session-hold-login');
  await act(async () => { fireEvent.click(screen.getByTestId('session-hold-login')); });
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)!);
  expect(pending.mode).toBe('reauth');
  const uuid = '22345678-1234-1234-1234-123456789abc';
  act(() => {
    sessionApi.completeSignIn(`?state=${pending.state}&access_token=other&refresh_token=refresh-b&expires_at=${session.tokens.expiresAt + 86400}&id=3&uuid=${uuid}&display_name=Sam`);
  });
  expect(sessionApi.session?.tokens.user.uuid).toBe(uuid);
  expect(sessionApi.cashiers.map(entry => entry.tokens.user.uuid)).toContain(session.tokens.user.uuid);
}, 20_000);

test('an expiry that lands after the session changed does not hold the new session', async () => {
  let reject!: (error: Error) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_resolve, fail) => { reject = fail; })));
  renderTill();
  await screen.findByText('Order store ready');
  act(() => { sessionApi.signOut(); });
  await act(async () => { reject(new SessionExpiredError()); });
  await waitFor(() => expect(sessionApi.ready).toBe(true));
  expect(sessionApi.held).toBe(false);
  expect(screen.queryByTestId('session-hold-banner')).toBeNull();
}, 20_000);
