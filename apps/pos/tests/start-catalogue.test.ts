import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { firstValueFrom, filter } from 'rxjs';
import { setSyncCadence, startCatalogueReconcile } from '@tallyui/database';
import { taxLogger } from '@tallyui/pos';
import type { Session } from '../lib/auth/session';
import { databaseName, startCatalogue } from '../lib/catalogue/start-catalogue';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { memoryStorage } from './memory-storage';

vi.mock('@tallyui/database', async importOriginal => {
  const actual = await importOriginal<typeof import('@tallyui/database')>();
  return { ...actual, startCatalogueReconcile: vi.fn(options => actual.startCatalogueReconcile(options)) };
});

let session: Session;

beforeEach(() => {
  const home = `https://shop.example/${crypto.randomUUID()}`;
  session = {
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Cashier' } },
  };
  for (const key of ['localStorage', 'sessionStorage']) {
    vi.stubGlobal(key, memoryStorage());
  }
});

afterEach(() => vi.unstubAllGlobals());

function fakeStore({ status = 200, advertised = [], site, coupons = [] }: { status?: number; advertised?: string[]; site?: Response | (() => Response); coupons?: any[] }) {
  return vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/stores')) return Response.json(stores);
    if (url.pathname.endsWith('/cashier/2')) return Response.json({ id: 2, capabilities: ['create_customers'] });
    if (url.pathname.endsWith('/status')) return Response.json({ capabilities: advertised }, { status });
    if (url.pathname.endsWith('/site') && site) return typeof site === 'function' ? site() : site;
    if (url.pathname.endsWith('/coupons')) {
      const include = url.searchParams.get('include');
      if (include !== null) {
        const ids = new Set(include.split(',').map(Number));
        return Response.json(coupons.filter(coupon => ids.has(coupon.id)));
      }
      return Response.json(Number(url.searchParams.get('page') ?? 1) === 1
        ? coupons.filter(coupon => coupon.status === 'publish') : []);
    }
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

test('reads cashier capabilities with the connector authorization headers', async () => {
  const fetchImpl = fakeStore({});
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory(), fetchImpl: fetchImpl as unknown as typeof fetch });
  try {
    expect(catalogue.cashier).toEqual({ known: true, granted: ['create_customers'] });
    const cashierRequests = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/cashier/2'));
    expect(cashierRequests).toHaveLength(1);
    expect(new Headers(cashierRequests[0][1]?.headers).get('Authorization')).toBe('Bearer t1');
  } finally {
    await catalogue.stop();
  }
});

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

// TallyUI 3.10.0: order.create 5 needs order_create_v5 in /status; 6 also needs /site to report WCPOS 1.9.0 or later, which gates coupons; order_payments_list alone gives split payments.
test.each([
  { advertised: [], site: '404', siteResponse: new Response(null, { status: 404 }), orderCreate: 3, multiplePayments: false, coupons: false },
  { advertised: [], site: '1.10.19', siteResponse: Response.json({ wcpos_version: '1.10.19' }), orderCreate: 3, multiplePayments: false, coupons: true },
  { advertised: [], site: '1.10.20', siteResponse: Response.json({ wcpos_version: '1.10.20' }), orderCreate: 3, multiplePayments: false, coupons: true },
  { advertised: ['order_create_v5'], site: 'none', orderCreate: 5, multiplePayments: false, coupons: false },
  { advertised: ['order_payments_list'], site: 'none', orderCreate: 3, multiplePayments: true, coupons: false },
  { advertised: ['order_create_v5', 'order_payments_list'], site: 'none', orderCreate: 5, multiplePayments: true, coupons: false },
  { advertised: ['order_create_v5'], site: '1.10.20', siteResponse: Response.json({ wcpos_version: '1.10.20' }), orderCreate: 8, multiplePayments: false, coupons: true },
  { advertised: ['order_create_v5'], site: '1.8.9', siteResponse: Response.json({ wcpos_version: '1.8.9' }), orderCreate: 5, multiplePayments: false, coupons: false },
])('reads order.create $orderCreate and coupons $coupons from status $advertised and site $site', async ({ advertised, siteResponse, orderCreate, multiplePayments, coupons }) => {
  vi.stubGlobal('fetch', fakeStore({ advertised, site: siteResponse }));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    expect(catalogue.capabilities?.orderCreate).toBe(orderCreate);
    expect(catalogue.capabilities?.multiplePayments).toBe(multiplePayments);
    expect(catalogue.capabilities?.coupons).toBe(coupons);
  } finally {
    await catalogue.stop();
  }
});

test('syncs published coupons into catalogue.coupons from /coupons', async () => {
  const published = {
    id: 7, code: 'save10', status: 'publish', discount_type: 'percent', amount: '10',
    date_modified_gmt: '2026-10-01T00:00:00', usage_count: 0, used_by: [],
    meta_data: [{ key: '_woocommerce_pos_uuid', value: 'c-7' }],
  };
  vi.stubGlobal('fetch', fakeStore({ coupons: [published, {
    ...published, id: 8, code: 'draft5', status: 'draft',
    meta_data: [{ key: '_woocommerce_pos_uuid', value: 'c-8' }],
  }] }));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    await vi.waitFor(async () => {
      const coupons = await catalogue.coupons.find().exec();
      expect(coupons).toHaveLength(1);
      expect(coupons[0].code).toBe('save10');
      expect(coupons[0].id).toBe(7);
    });
  } finally {
    await catalogue.stop();
  }
});

test('the coupons collection stays empty when the store lists no coupons', async () => {
  vi.stubGlobal('fetch', fakeStore({}));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    const coupons = (catalogue.db.collections as Record<string, RxCollection>).coupons;
    expect(coupons).toBeDefined();
    expect(await coupons.find().exec()).toEqual([]);
  } finally {
    await catalogue.stop();
  }
});

test('keeps a local logs collection that the TallyUI loggers write to until stop', async () => {
  const fetchImpl = fakeStore({});
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory(), fetchImpl: fetchImpl as unknown as typeof fetch });
  let stopped = false;
  try {
    taxLogger.warn('catalogue log test');
    await vi.waitFor(async () => {
      const rows = await catalogue.logs.find({ selector: { message: 'catalogue log test' } }).exec();
      expect(rows).toHaveLength(1);
      expect(rows[0].scope).toBe('tax');
    });
    const insert = vi.spyOn(catalogue.logs, 'insert');
    await catalogue.stop();
    stopped = true;
    taxLogger.warn('after stop');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(insert).not.toHaveBeenCalled();
  } finally {
    if (!stopped) await catalogue.stop();
  }
});

test('logs a store-sync row when the products pull', async () => {
  vi.stubGlobal('fetch', fakeStore({}));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    await catalogue.replication.awaitInitialReplication();
    await vi.waitFor(async () => {
      const rows = await catalogue.logs.find({ selector: { scope: 'sync' } }).exec();
      const row = rows.find(row => row.detail?.includes('"collection":"products"'));
      expect(row).toBeDefined();
      expect(row!.message).toMatch(/^Saved updates from your store · \d+ records?$/);
      expect(row!.durationMs).toEqual(expect.any(Number));
    });
  } finally {
    await catalogue.stop();
  }
});

test('logs a store-sync row when the coupons pull', async () => {
  const fetchImpl = fakeStore({
    coupons: [{
      id: 7, code: 'save10', status: 'publish', discount_type: 'percent', amount: '10',
      date_modified_gmt: '2026-10-01T00:00:00', usage_count: 0, used_by: [],
      meta_data: [{ key: '_woocommerce_pos_uuid', value: 'c-7' }],
    }],
    site: Response.json({ wcpos_version: '1.10.20' }),
  });
  // No product documents: the sync row must come from the coupons replication.
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async input => new URL(String(input)).pathname.endsWith('/products')
    ? Response.json([], { headers: { 'X-WP-Total': '0' } })
    : fetchImpl(String(input))));
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    await vi.waitFor(async () => {
      const rows = await catalogue.logs.find({ selector: { scope: 'sync' } }).exec();
      const row = rows.find(row => row.detail?.includes('"collection":"coupons"'));
      expect(row).toBeDefined();
      expect(row!.message).toMatch(/^Saved updates from your store · \d+ records?$/);
      expect(row!.durationMs).toEqual(expect.any(Number));
    });
  } finally {
    await catalogue.stop();
  }
});

function productRequests(fetchImpl: ReturnType<typeof fakeStore>) {
  return fetchImpl.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.pathname.endsWith('/products'));
}

test('meters the sync requests into hourly buckets', async () => {
  const fetchImpl = fakeStore({});
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    await catalogue.replication.awaitInitialReplication();
    const productCalls = productRequests(fetchImpl).length;
    expect(productCalls).toBeGreaterThan(0);
    const metered = catalogue.requestMetrics.buckets().reduce((sum, bucket) => sum + bucket.requests, 0);
    expect(metered).toBeGreaterThanOrEqual(productCalls);
    expect(catalogue.db.collections.request_metrics).toBeDefined();
    expect(catalogue.db.collections.sync_cadence).toBeDefined();
  } finally {
    await catalogue.stop();
  }
});

test('pulls pages of the stored cadence size, Balanced by default', async () => {
  const fetchImpl = fakeStore({});
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    await catalogue.replication.awaitInitialReplication();
    // Pages carry `offset`; the connector's pass-mark probe (per_page 1, orderby modified) is a fixed size.
    const pages = productRequests(fetchImpl).filter(url => url.searchParams.has('offset'))
      .map(url => url.searchParams.get('per_page'));
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toEqual(pages.map(() => '50'));
  } finally {
    await catalogue.stop();
  }
});

test('checks for product changes on the cadence timer', async () => {
  const fetchImpl = fakeStore({});
  vi.stubGlobal('fetch', fetchImpl);
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  let latest: number | undefined;
  const subscription = catalogue.cadence.nextDueAtMs$.subscribe(value => { latest = value; });
  try {
    const due = await firstValueFrom(catalogue.cadence.nextDueAtMs$.pipe(filter(value => value !== undefined)));
    expect(due - Date.now()).toBeGreaterThanOrEqual(47_000);
    expect(due - Date.now()).toBeLessThanOrEqual(73_000);
    await catalogue.replication.awaitInSync();
    const before = productRequests(fetchImpl).length;
    catalogue.cadence.tickNow();
    await vi.waitFor(() => expect(productRequests(fetchImpl).length).toBeGreaterThan(before));
    await setSyncCadence(catalogue.syncCadence, 'realtime');
    await vi.waitFor(() => expect(latest! - Date.now()).toBeLessThanOrEqual(12_500));
  } finally {
    subscription.unsubscribe();
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

test('passes each catalogue check a log that writes its rows', async () => {
  vi.stubGlobal('fetch', fakeStore({}));
  vi.mocked(startCatalogueReconcile).mockClear();
  const catalogue = await startCatalogue(session, { storage: getRxStorageMemory() });
  try {
    const products = vi.mocked(startCatalogueReconcile).mock.calls[0][0];
    const coupons = vi.mocked(startCatalogueReconcile).mock.calls[1][0];
    expect(products.collection).toBe(catalogue.db.products);
    expect(coupons.collection).toBe(catalogue.db.coupons);
    products.log!({ type: 'tombstoned', count: 2, keys: ['1', '2'] });
    coupons.log!({ type: 'refetched', count: 3, keys: ['a', 'b', 'c'] });
    await vi.waitFor(async () => {
      const rows = await catalogue.logs.find({ selector: { scope: 'sync' } }).exec();
      expect(rows.find(row => row.message === 'Removed items deleted in your store · 2')?.detail)
        .toContain('"collection":"products"');
      expect(rows.find(row => row.message === 'Fetched records again for missing details · 3')?.detail)
        .toContain('"collection":"coupons"');
    });
  } finally {
    await catalogue.stop();
  }
});
