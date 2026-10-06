import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { Session } from '../lib/auth/session';
import { databaseName, startCatalogue } from '../lib/catalogue/start-catalogue';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

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

function fakeStore({ status = 200, advertised = [], site }: { status?: number; advertised?: string[]; site?: Response | (() => Response) }) {
  return vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/stores')) return Response.json(stores);
    if (url.pathname.endsWith('/status')) return Response.json({ capabilities: advertised }, { status });
    if (url.pathname.endsWith('/site') && site) return typeof site === 'function' ? site() : site;
    if (url.pathname.endsWith('/variations')) {
      const included = new Set(url.searchParams.get('include')?.split(',').map(Number) ?? []);
      const documents = variations.documents.filter(variation => included.has(variation.id));
      return Response.json({ documents, meta: {} });
    }
    if (!url.pathname.endsWith('/products')) throw new Error(`Unexpected request: ${url.pathname}`);
    const modifiedAfter = url.searchParams.get('modified_after');
    const matching = products.filter(product => !modifiedAfter || product.date_modified_gmt > modifiedAfter);
    const ordered = [...matching].sort(url.searchParams.get('orderby') === 'modified'
      ? (a, b) => b.date_modified_gmt.localeCompare(a.date_modified_gmt) : (a, b) => a.id - b.id);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('per_page'));
    return Response.json(ordered.slice(offset, offset + limit), { headers: { 'X-WP-Total': String(matching.length) } });
  });
}

test('database names use stable FNV-1a hashes and valid RxDB characters', () => {
  const name = databaseName(session);
  expect(name).toBe(databaseName(session));
  expect(name).toMatch(/^[a-z][_$a-z0-9-]*$/);
  expect(databaseName({ ...session, site: { ...session.site, home: 'hello' } })).toBe('tallywoo_4f9f2cab_2');
  expect(databaseName({ ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, id: 3 } } })).not.toBe(name);
});

test.each([
  { status: 200, advertised: ['order_payments_list'], multiplePayments: true },
  { status: 200, advertised: [], multiplePayments: false },
  { status: 503, advertised: [], multiplePayments: false },
])('replicates, updates auth and stops with status $status and payments list $multiplePayments', async ({ status, advertised, multiplePayments }) => {
  const fetchImpl = fakeStore({ status, advertised });
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    expect(catalogue.capabilities?.multiplePayments).toBe(multiplePayments);
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/status'))).toHaveLength(1);
    expect(catalogue.parkedCarts.name).toBe('parked_carts');
    expect(catalogue.parkedCarts.database).toBe(catalogue.db);
    expect(await catalogue.parkedCarts.find().exec()).toEqual([]);
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

// TallyUI 3.5.3 reads order.create v5 only from order_create_v5 in /status: a 1.10.20 store stays on v3, and order_payments_list alone gives split payments, not v5.
test.each([
  { advertised: [], site: '404', siteResponse: new Response(null, { status: 404 }), orderCreate: 3, multiplePayments: false },
  { advertised: [], site: '1.10.19', siteResponse: Response.json({ wcpos_version: '1.10.19' }), orderCreate: 3, multiplePayments: false },
  { advertised: [], site: '1.10.20', siteResponse: Response.json({ wcpos_version: '1.10.20' }), orderCreate: 3, multiplePayments: false },
  { advertised: ['order_create_v5'], site: 'none', orderCreate: 5, multiplePayments: false },
  { advertised: ['order_payments_list'], site: 'none', orderCreate: 3, multiplePayments: true },
  { advertised: ['order_create_v5', 'order_payments_list'], site: 'none', orderCreate: 5, multiplePayments: true },
])('reads order.create $orderCreate from status $advertised and site $site', async ({ advertised, siteResponse, orderCreate, multiplePayments }) => {
  vi.stubGlobal('fetch', fakeStore({ advertised, site: siteResponse }));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    expect(catalogue.capabilities?.orderCreate).toBe(orderCreate);
    expect(catalogue.capabilities?.multiplePayments).toBe(multiplePayments);
  } finally {
    await catalogue.stop();
  }
});

test.each([401, 403])('surfaces a capability read refused with HTTP %s', async status => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async input => String(input).endsWith('/stores')
    ? Response.json(stores) : new Response(null, { status })));
  await expect(startCatalogue(session, { storage: getRxStorageMemory() })).rejects.toMatchObject({
    code: status === 401 ? 'unauthorized' : 'forbidden', status,
  });
});
