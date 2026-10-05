import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Session } from '../lib/auth/session';
import { databaseName, startCatalogue } from '../lib/catalogue/start-catalogue';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

let session: Session;

beforeEach(() => {
  const home = `https://shop.example/${crypto.randomUUID()}`;
  session = {
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Cashier' } },
  };
  for (const key of ['localStorage', 'sessionStorage']) {
    const data = new Map<string, string>();
    vi.stubGlobal(key, {
      get length() { return data.size; },
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
      clear: () => data.clear(),
      key: (index: number) => Array.from(data.keys())[index] ?? null,
    });
  }
});

afterEach(() => vi.unstubAllGlobals());

test('database names use stable FNV-1a hashes and valid RxDB characters', () => {
  const name = databaseName(session);
  expect(name).toBe(databaseName(session));
  expect(name).toMatch(/^[a-z][_$a-z0-9-]*$/);
  expect(databaseName({ ...session, site: { ...session.site, home: 'hello' } })).toBe('tallywoo_4f9f2cab_2');
  expect(databaseName({ ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, id: 3 } } })).not.toBe(name);
});

test('replicates the real fixtures in memory, updates auth headers and stops', async () => {
  const fetchImpl = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/stores')) return Response.json(stores);
    if (!url.pathname.endsWith('/products')) throw new Error(`Unexpected request: ${url.pathname}`);
    const modifiedAfter = url.searchParams.get('modified_after');
    const matching = products.filter(product => !modifiedAfter || product.date_modified_gmt > modifiedAfter);
    const ordered = [...matching].sort(url.searchParams.get('orderby') === 'modified'
      ? (a, b) => b.date_modified_gmt.localeCompare(a.date_modified_gmt) : (a, b) => a.id - b.id);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('per_page'));
    return Response.json(ordered.slice(offset, offset + limit), { headers: { 'X-WP-Total': String(matching.length) } });
  });
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session);
  try {
    await catalogue.replication.awaitInitialReplication();
    const docs = (await catalogue.db.products.find().exec()).map(doc => doc.toJSON()).sort((a, b) => a.id - b.id);
    expect(docs).toHaveLength(products.length);
    products.forEach((product, index) => expect(docs[index]).toMatchObject({
      id: product.id, name: product.name, sku: product.sku,
      uuid: product.meta_data[0].value, barcode: product.global_unique_id,
    }));
    expect(catalogue.store.currency).toBe('USD');
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer t1');
    await catalogue.replication.awaitInSync();
    const before = fetchImpl.mock.calls.length;
    catalogue.setAccessToken('t2');
    await vi.waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThan(before));
    expect(new Headers(fetchImpl.mock.calls[before][1]?.headers).get('Authorization')).toBe('Bearer t2');
  } finally {
    await expect(catalogue.stop()).resolves.toBeUndefined();
  }
  expect(catalogue.db.closed).toBe(true);
});
