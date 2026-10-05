import { createElement, StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildAuthUrl, newState, parseCallback } from '../lib/auth/login';
import { SessionProvider } from '../lib/auth/session-context';
import { loadSession, PENDING_KEY } from '../lib/auth/session';
import Callback from '../app/auth/callback';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(() => null) }));
vi.mock('expo-router', () => ({ Redirect: redirect }));
const query = '?access_token=access.jwt.token&refresh_token=refresh.jwt.token&token_type=Bearer' +
  '&expires_at=1791240388&id=2&uuid=12345678-1234-1234-1234-123456789abc&display_name=cashier&state=expected';

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

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  redirect.mockClear();
  vi.unstubAllGlobals();
});

test('builds a login URL preserving the existing query and encoding redirect_uri', () => {
  const url = buildAuthUrl('https://shop.example/wcpos-auth/?existing=1', 'https://pos.example/auth/callback', 'a b');
  expect(url).toBe('https://shop.example/wcpos-auth/?existing=1&redirect_uri=https%3A%2F%2Fpos.example%2Fauth%2Fcallback&state=a+b&platform=web');
});

test('generates 32 hex characters from 16 random bytes', () => {
  const random = vi.spyOn(crypto, 'getRandomValues');
  expect(newState()).toMatch(/^[0-9a-f]{32}$/);
  expect(random).toHaveBeenCalledExactlyOnceWith(expect.any(Uint8Array));
  expect(random.mock.calls[0][0]?.byteLength).toBe(16);
});

test('parses the real callback query format', () => {
  expect(parseCallback(query, 'expected')).toEqual({
    accessToken: 'access.jwt.token', refreshToken: 'refresh.jwt.token', expiresAt: 1791240388,
    user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'cashier' },
  });
});

test.each(['wrong', 'Expected', 'expected '])('rejects mismatched state %s', state => {
  expect(() => parseCallback(query, state)).toThrow(expect.objectContaining({ code: 'state_mismatch' }));
});

test('rejects missing state before checking tokens', () => {
  expect(() => parseCallback('', 'expected')).toThrow(expect.objectContaining({ code: 'state_mismatch' }));
});

test.each(['access_token', 'refresh_token'])('requires %s', key => {
  const params = new URLSearchParams(query);
  params.delete(key);
  expect(() => parseCallback(`?${params}`, 'expected')).toThrow(expect.objectContaining({ code: 'missing_token' }));
});

test.each(['expected', 'wrong'])('callback redirects with pending state %s', async state => {
  const home = 'https://shop.example';
  const site = { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, site }));
  window.history.replaceState(null, '', `/auth/callback${query.replace('1791240388', '4102444800')}`);
  render(createElement(StrictMode, null, createElement(SessionProvider, null, createElement(Callback))));
  if (state === 'expected') {
    await waitFor(() => expect(redirect).toHaveBeenCalledWith({ href: '/catalogue' }, undefined));
    expect(loadSession()).toMatchObject({ site, tokens: { accessToken: 'access.jwt.token' } });
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  } else {
    await waitFor(() => expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/connect', params: { error: 'state_mismatch' } },
    }, undefined));
    expect(loadSession()).toBeNull();
  }
});

test('redirects a callback without pending sign-in to connect with an error', async () => {
  window.history.replaceState(null, '', `/auth/callback${query}`);
  render(createElement(SessionProvider, null, createElement(Callback)));
  await waitFor(() => expect(redirect).toHaveBeenCalledWith({
    href: { pathname: '/connect', params: { error: 'no_pending' } },
  }, undefined));
  expect(loadSession()).toBeNull();
});
