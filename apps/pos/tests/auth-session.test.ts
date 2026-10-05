import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { clearSession, loadSession, REFRESH_WINDOW_SECONDS, refreshSession, saveSession, SESSION_KEY, SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';

const now = 1791239000;
const home = 'https://shop.example';
const session: Session = {
  site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
  tokens: {
    accessToken: 'old-access', refreshToken: 'refresh', expiresAt: now + 300,
    user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'cashier' },
  },
};
const wrapper = ({ children }: { children: ReactNode }) => createElement(SessionProvider, { children });

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
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

test('round trips and clears the session under its storage key', () => {
  const storage = memoryStorage();
  expect(loadSession(storage)).toBeNull();
  saveSession(session, storage);
  expect(loadSession(storage)).toEqual(session);
  expect(storage.getItem(SESSION_KEY)).toBe(JSON.stringify(session));
  clearSession(storage);
  expect(loadSession(storage)).toBeNull();
});

test('returns null for corrupt JSON', () => {
  const storage = memoryStorage();
  storage.setItem(SESSION_KEY, '{broken');
  expect(loadSession(storage)).toBeNull();
});

test('handles throwing storage without throwing', () => {
  const fail = () => { throw new Error('Storage unavailable'); };
  const storage: Storage = { ...memoryStorage(), getItem: fail, setItem: fail, removeItem: fail };
  expect(loadSession(storage)).toBeNull();
  expect(() => saveSession(session, storage)).not.toThrow();
  expect(() => clearSession(storage)).not.toThrow();
});

test('returns the same session without fetching outside the refresh window', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
  const fresh = { ...session, tokens: { ...session.tokens, expiresAt: now + 361 } };
  expect(REFRESH_WINDOW_SECONDS).toBe(360);
  expect(await refreshSession(fresh, fetchImpl as unknown as typeof fetch, now)).toBe(fresh);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test.each([
  { access_token: 'new-access', token_type: 'Bearer', expires_in: 1800, expires_at: now + 1800 },
  { access_token: 'new-access', token_type: 'Bearer', expires_in: 1800 },
])('refreshes at the window boundary, preserving refresh token and user', async body => {
  const due = { ...session, tokens: { ...session.tokens, expiresAt: now + 360 } };
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json(body));
  const result = await refreshSession(due, fetchImpl as unknown as typeof fetch, now);
  expect(result).not.toBe(due);
  expect(result.tokens).toEqual({ ...session.tokens, accessToken: 'new-access', expiresAt: now + 1800 });
  expect(result.tokens.user).toBe(session.tokens.user);
  expect(due.tokens.accessToken).toBe('old-access');
  expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(`${home}/wp-json/wcpos/v2/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WCPOS': '1' },
    body: JSON.stringify({ refresh_token: 'refresh' }),
  });
});

test('treats an HTTP 200 invalid_grant response as an expired session', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ error: 'invalid_grant', error_description: 'Wrong number of segments' }));
  await expect(refreshSession(session, fetchImpl as unknown as typeof fetch, now)).rejects.toBeInstanceOf(SessionExpiredError);
});

test('rethrows the same network rejection', async () => {
  const error = new TypeError('offline');
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockRejectedValue(error);
  await expect(refreshSession(session, fetchImpl as unknown as typeof fetch, now)).rejects.toBe(error);
});

test.each([400, 401, 403, 404])('expires the session for HTTP %s regardless of body', async status => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response('not JSON', { status }));
  await expect(refreshSession(session, fetchImpl as unknown as typeof fetch, now)).rejects.toBeInstanceOf(SessionExpiredError);
});

test.each([500, 503])('keeps HTTP %s errors distinct from expired sessions', async status => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response('not JSON', { status }));
  const error = await refreshSession(session, fetchImpl as unknown as typeof fetch, now).catch(error => error);
  expect(error.constructor).toBe(Error);
  expect(error.message).toBe(`refresh failed: ${status}`);
});

test('keeps a non-JSON success response distinct from an expired session', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response('not JSON'));
  const error = await refreshSession(session, fetchImpl as unknown as typeof fetch, now).catch(error => error);
  expect(error.constructor).toBe(Error);
  expect(error.message).toBe('refresh failed: bad body');
});

test('restores the session, refreshes every five minutes, and signs out', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
  const fresh = { ...session, tokens: { ...session.tokens, expiresAt: now + 1000 } };
  saveSession(fresh);
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ access_token: 'renewed', expires_in: 1800 }));
  vi.stubGlobal('fetch', fetchImpl);
  const { result, unmount } = renderHook(useSession, { wrapper });
  await act(async () => {});
  expect(result.current.ready).toBe(true);
  expect(result.current.session).toEqual(fresh);
  await act(() => vi.advanceTimersByTimeAsync(600000));
  expect(fetchImpl).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(300000));
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(result.current.session?.tokens.accessToken).toBe('renewed');
  expect(loadSession()).toEqual(result.current.session);
  act(() => result.current.signOut());
  expect(result.current.session).toBeNull();
  expect(loadSession()).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(300000));
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test.each(['network', 'expired'])('handles a %s failure during the initial refresh', async outcome => {
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
  saveSession(session);
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
  if (outcome === 'network') fetchImpl.mockRejectedValue(new TypeError('offline'));
  else fetchImpl.mockResolvedValue(Response.json({ error: 'invalid_grant' }));
  vi.stubGlobal('fetch', fetchImpl);
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  expect(result.current.ready).toBe(true);
  expect(result.current.session).toEqual(outcome === 'network' ? session : null);
  expect(loadSession()).toEqual(result.current.session);
});

test('an in-flight refresh cannot restore a signed-out session', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
  saveSession(session);
  let resolve!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>(done => { resolve = done; })));
  const { result } = renderHook(useSession, { wrapper });
  act(() => result.current.signOut());
  await act(async () => { resolve(Response.json({ access_token: 'renewed', expires_in: 1800 })); });
  expect(result.current.session).toBeNull();
  expect(loadSession()).toBeNull();
});
