import { expect, test, vi } from 'vitest';
import { SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { fetchStoreInfo } from '../lib/catalogue/store-info';
import stores from './fixtures/stores.json';

const home = 'https://shop.example';
const session: Session = {
  site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
  tokens: { accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Cashier' } },
};
const headers = { Authorization: 'Bearer t1' };

test('maps the first fixture store and sends the supplied headers', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(stores));
  expect(await fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).toEqual({
    id: 0, name: stores[0].name, currency: 'USD', locale: 'en_US',
  });
  expect(fetchImpl).toHaveBeenCalledWith(`${session.site.wcposApiUrl}/stores`, { headers });
});

test('uppercases the currency', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ ...stores[0], currency: 'usd' }]));
  expect((await fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).currency).toBe('USD');
});

test.each([401, 403])('rejects a %i as an expired session', async status => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
  await expect(fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SessionExpiredError);
});

test('rejects a 500 as a plain failure, not an expired session', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
  const failure = fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch);
  await expect(failure).rejects.toThrow('stores request failed: 500');
  await expect(failure).rejects.not.toBeInstanceOf(SessionExpiredError);
});

test('rejects an empty array', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
  await expect(fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).rejects.toThrow('stores response is empty');
});
