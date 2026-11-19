import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { loadCashiers, loadSession, PENDING_KEY, saveSession } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { SessionProvider, useSession } from '../lib/auth/session-context';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { memoryStorage } from './memory-storage';

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

async function signIn(active: Session, mode: 'reauth' | 'add', search: string) {
  saveSession(active);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state: 's', site, mode }));
  const hook = renderHook(useSession, { wrapper });
  await act(async () => {});
  act(() => { hook.result.current.completeSignIn(search); });
  return hook.result;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn());
  vi.useFakeTimers();
  vi.setSystemTime(now * 1000);
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('a reauth that returns another user toasts once with both names and keeps the roster and session as today', async () => {
  const result = await signIn(a, 'reauth', bSearch);
  expect(getToasts()).toEqual([expect.objectContaining({
    type: 'info',
    title: 'Signed in as a different user — Cashier B is now signed in, and Cashier A stays in the cashier list.',
  })]);
  expect(result.current.session).toEqual({ ...b, signedInAt: expect.any(Number) });
  expect(loadSession()).toEqual({ ...b, signedInAt: expect.any(Number) });
  expect(result.current.cashiers).toEqual([a]);
  expect(loadCashiers()[home]).toEqual([a]);
});

test('a reauth with an empty display name falls back to the new user and the previous cashier', async () => {
  const nameless = { ...a, tokens: { ...a.tokens, user: { ...a.tokens.user, displayName: '' } } };
  await signIn(nameless, 'reauth', bSearch.replace('display_name=Cashier+B', 'display_name='));
  expect(getToasts()).toEqual([expect.objectContaining({
    type: 'info',
    title: 'Signed in as a different user — the new user is now signed in, and the previous cashier stays in the cashier list.',
  })]);
});

test('a reauth that returns the same user shows no toast', async () => {
  await signIn(a, 'reauth', `?state=s&access_token=renewed-a&refresh_token=refresh-a&expires_at=${a.tokens.expiresAt}&id=1&uuid=${a.tokens.user.uuid}&display_name=Cashier+A`);
  expect(getToasts()).toEqual([]);
});

test('an add of another user shows no toast', async () => {
  await signIn(a, 'add', bSearch);
  expect(getToasts()).toEqual([]);
});
