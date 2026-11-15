import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { TallyConnector } from '@tallyui/core';
import { useRequestContext } from '../lib/auth/request-context';
import type { Session } from '../lib/auth/session';

afterEach(() => { cleanup(); });

const fakeConnector = () => ({
  id: 'woo',
  auth: { getHeaders: vi.fn(({ token }: { token: string }) => ({ Authorization: `Bearer ${token}` })) },
}) as unknown as TallyConnector;
const fakeSession = (home: string, accessToken: string) => ({
  site: { home, wcposApiUrl: `${home}/wp-json/wcpos/v2` },
  tokens: { accessToken },
}) as unknown as Session;
const a = fakeSession('https://a.example', 'token-a');
const b = fakeSession('https://b.example', 'token-b');

test('the context carries the connector id, the site API url and the token headers', () => {
  const connector = fakeConnector();
  const { result } = renderHook(() => useRequestContext(connector, a));
  expect(result.current()).toEqual({
    connectorId: 'woo',
    baseUrl: 'https://a.example/wp-json/wcpos/v2',
    headers: { Authorization: 'Bearer token-a' },
  });
  expect(connector.auth.getHeaders).toHaveBeenCalledWith({ token: 'token-a' });
});

test('the session is read when the function is called, not when it was rendered', () => {
  const connector = fakeConnector();
  const { result, rerender } = renderHook(({ session }) => useRequestContext(connector, session), { initialProps: { session: a } });
  const f = result.current;
  rerender({ session: b });
  expect(f()).toMatchObject({ baseUrl: 'https://b.example/wp-json/wcpos/v2', headers: { Authorization: 'Bearer token-b' } });
});

test('the function changes only with the connector', () => {
  const connector = fakeConnector();
  const { result, rerender } = renderHook(({ c, session }) => useRequestContext(c, session), { initialProps: { c: connector, session: a } });
  const first = result.current;
  rerender({ c: connector, session: b });
  expect(result.current).toBe(first);
  rerender({ c: fakeConnector(), session: b });
  expect(result.current).not.toBe(first);
});
