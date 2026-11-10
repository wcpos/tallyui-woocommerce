import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OnlineStatusProvider, SessionOnlineStatusProvider, useOnlineStatus } from '../lib/online/online-status';

let online: boolean;
let visibility: DocumentVisibilityState;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let site: string;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  online = true;
  visibility = 'visible';
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  site = `https://shop.example/${crypto.randomUUID()}/wp-json`;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'onLine');
  Reflect.deleteProperty(document, 'visibilityState');
});

async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function Status() { return <span data-testid="online-status">{useOnlineStatus().status}</span>; }
function mount(url: string | null = site) {
  return render(<OnlineStatusProvider wpApiUrl={url}><Status /></OnlineStatusProvider>);
}
function status() { return screen.getByTestId('online-status').textContent; }
function answer(code: number) { fetchMock.mockResolvedValue({ status: code } as Response); }
function fail() { fetchMock.mockRejectedValue(new TypeError('Failed to fetch')); }

test('starts offline when the browser reports offline', async () => {
  online = false;
  fail();
  mount();
  await advance(0);
  expect(status()).toBe('offline');
});

test('one failed probe leaves the store available and probes HEAD then GET at the ping route', async () => {
  fail();
  mount();
  await advance(0);
  expect(status()).toBe('online-website-available');
  expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
    [`${site}/wcpos/v2/ping?wcpos=1`, 'HEAD'], [`${site}/wcpos/v2/ping?wcpos=1`, 'GET'],
  ]);
});

test('reads the website unavailable once no probe has answered for 30 seconds', async () => {
  fail();
  mount();
  await advance(0);
  await advance(29_000);
  expect(status()).toBe('online-website-available');
  await advance(1_000);
  expect(status()).toBe('online-website-unavailable');
});

test('the first answer restores available when the browser comes back online', async () => {
  fail();
  mount();
  await advance(0);
  await advance(30_000);
  expect(status()).toBe('online-website-unavailable');
  answer(200);
  act(() => { window.dispatchEvent(new Event('online')); });
  await advance(0);
  expect(status()).toBe('online-website-available');
});

test('a dropped link restarts the failure window', async () => {
  fail();
  mount();
  await advance(0);
  await advance(20_000);
  online = false;
  act(() => { window.dispatchEvent(new Event('offline')); });
  await advance(0);
  expect(status()).toBe('offline');
  online = true;
  act(() => { window.dispatchEvent(new Event('online')); });
  await advance(0);
  expect(status()).toBe('offline');
  await advance(10_000);
  expect(status()).toBe('offline');
  await advance(30_000);
  expect(status()).toBe('online-website-unavailable');
});

test('probes again when the page becomes visible', async () => {
  answer(200);
  mount();
  await advance(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await advance(0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('does not probe on the interval while the page is hidden', async () => {
  answer(200);
  mount();
  await advance(0);
  visibility = 'hidden';
  await advance(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a new store URL starts its own failure window', async () => {
  fail();
  const { rerender } = mount();
  await advance(0);
  await advance(29_500);
  rerender(<OnlineStatusProvider wpApiUrl={`${site}/other`}><Status /></OnlineStatusProvider>);
  await advance(0);
  expect(status()).toBe('online-website-available');
  expect(fetchMock.mock.calls.at(-1)?.[0]).toEqual(expect.stringMatching(`^${site}/other/`));
});

test('without a store it never probes and follows the browser events', async () => {
  mount(null);
  await advance(60_000);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(status()).toBe('online-website-available');
  online = false;
  act(() => { window.dispatchEvent(new Event('offline')); });
  await advance(0);
  expect(status()).toBe('offline');
  online = true;
  act(() => { window.dispatchEvent(new Event('online')); });
  await advance(0);
  expect(status()).toBe('online-website-available');
  expect(fetchMock).not.toHaveBeenCalled();
});

test("the session provider probes the signed-in store's ping route", async () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Shop', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  answer(200);
  render(<SessionProvider><SessionOnlineStatusProvider><Status /></SessionOnlineStatusProvider></SessionProvider>);
  await advance(0);
  expect(fetchMock).toHaveBeenCalledWith(`${home}/wp-json/wcpos/v2/ping?wcpos=1`, expect.objectContaining({ method: 'HEAD' }));
});
