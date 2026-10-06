import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CASHIERS_KEY, loadCashiers, loadSession, PENDING_KEY, saveCashiers, saveSession, SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';

const now = 1791239000;
const home = 'https://shop.example';
const site = { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` };
const a: Session = {
  site,
  tokens: {
    accessToken: 'access-a', refreshToken: 'refresh-a', expiresAt: now + 86400,
    user: { id: 1, uuid: '12345678-1234-1234-1234-123456789aaa', displayName: 'Cashier A' },
  },
};
const b: Session = {
  site,
  tokens: {
    accessToken: 'access-b', refreshToken: 'refresh-b', expiresAt: now + 86400,
    user: { id: 2, uuid: '12345678-1234-1234-1234-123456789bbb', displayName: 'Cashier B' },
  },
};
const bSearch = `?state=s&access_token=access-b&refresh_token=refresh-b&expires_at=${b.tokens.expiresAt}&id=2&uuid=${b.tokens.user.uuid}&display_name=Cashier+B`;
const wrapper = ({ children }: { children: ReactNode }) => createElement(SessionProvider, { children });

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn());
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
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

test('adding a cashier keeps the active cashier and lists the new one', async () => {
  saveSession(a);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state: 's', site, mode: 'add' }));
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  act(() => { expect(result.current.completeSignIn(bSearch)).toEqual(b); });
  expect(result.current.session).toEqual(a);
  expect(result.current.cashiers).toEqual([b]);
  expect(loadSession()).toEqual(a);
  expect(loadCashiers()[home]).toEqual([b]);
  expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test('adding the active cashier again renews them and lists no one', async () => {
  saveSession(a);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state: 's', site, mode: 'add' }));
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  act(() => {
    result.current.completeSignIn(`?state=s&access_token=renewed-a&refresh_token=refresh-a&expires_at=${a.tokens.expiresAt}&id=1&uuid=${a.tokens.user.uuid}&display_name=Cashier+A`);
  });
  const renewed = { ...a, tokens: { ...a.tokens, accessToken: 'renewed-a' } };
  expect(result.current.session).toEqual(renewed);
  expect(result.current.cashiers).toEqual([]);
  expect(loadSession()).toEqual(renewed);
  expect(loadCashiers()[home]).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

test('switching makes the chosen cashier active and lists the previous one', async () => {
  saveSession(a);
  saveCashiers({ [home]: [b] });
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  await act(() => result.current.switchCashier(b.tokens.user.uuid));
  expect(result.current.session).toEqual(b);
  expect(result.current.cashiers).toEqual([a]);
  expect(loadSession()).toEqual(b);
  expect(loadCashiers()[home]).toEqual([a]);
  expect(fetch).not.toHaveBeenCalled();
});

test('switching to a cashier whose sign-in expired forgets them', async () => {
  saveSession(a);
  const due = { ...b, tokens: { ...b.tokens, expiresAt: now + 300 } };
  saveCashiers({ [home]: [due] });
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  await act(async () => {
    await expect(result.current.switchCashier(b.tokens.user.uuid)).rejects.toBeInstanceOf(SessionExpiredError);
  });
  expect(result.current.session).toEqual(a);
  expect(result.current.cashiers).toEqual([]);
  expect(loadSession()).toEqual(a);
  expect(loadCashiers()[home]).toEqual([]);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(`${site.wcposApiUrl}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WCPOS': '1' },
    body: JSON.stringify({ refresh_token: b.tokens.refreshToken }),
  });
});

test('a switch that fails for another reason changes nothing', async () => {
  saveSession(a);
  const due = { ...b, tokens: { ...b.tokens, expiresAt: now + 300 } };
  saveCashiers({ [home]: [due] });
  const error = new TypeError('offline');
  vi.mocked(fetch).mockRejectedValue(error);
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  await act(async () => {
    await expect(result.current.switchCashier(b.tokens.user.uuid)).rejects.toBe(error);
  });
  expect(result.current.session).toEqual(a);
  expect(result.current.cashiers).toEqual([due]);
  expect(loadSession()).toEqual(a);
  expect(loadCashiers()[home]).toEqual([due]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('signing out keeps the other cashiers, and signing one of them in again removes the duplicate', async () => {
  saveSession(a);
  saveCashiers({ [home]: [b] });
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  act(() => result.current.signOut());
  expect(result.current.session).toBeNull();
  expect(result.current.cashiers).toEqual([]);
  expect(loadSession()).toBeNull();
  expect(loadCashiers()[home]).toEqual([b]);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state: 's2', site }));
  act(() => { result.current.completeSignIn(bSearch.replace('state=s&', 'state=s2&')); });
  expect(result.current.session).toEqual(b);
  expect(result.current.cashiers).toEqual([]);
  expect(loadSession()).toEqual(b);
  expect(loadCashiers()[home]).toEqual([]);
  expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test('startAddCashier records an add for the active site', async () => {
  saveSession(a);
  const { result } = renderHook(useSession, { wrapper });
  await act(async () => {});
  act(() => result.current.startAddCashier());
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)!);
  expect(pending.mode).toBe('add');
  expect(pending.site).toEqual(a.site);
  expect(pending.state).toEqual(expect.any(String));
  expect(pending.state.length).toBeGreaterThan(0);
  expect(fetch).not.toHaveBeenCalled();
});

test('loadCashiers survives a corrupt or throwing storage', () => {
  const storage = memoryStorage();
  expect(loadCashiers(storage)).toEqual({});
  storage.setItem(CASHIERS_KEY, '{broken');
  expect(loadCashiers(storage)).toEqual({});
  const fail = () => { throw new Error('Storage unavailable'); };
  const throwing: Storage = { ...memoryStorage(), getItem: fail, setItem: fail };
  expect(loadCashiers(throwing)).toEqual({});
  expect(() => saveCashiers({ [home]: [b] }, throwing)).not.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
