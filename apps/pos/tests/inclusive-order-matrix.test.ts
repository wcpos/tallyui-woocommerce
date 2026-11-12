// Inclusive-tax order matrix: six sales recorded on 2026-11-12 from the Mac mini dev store (WCPOS 1.10.20 + tally
// overlay, prices entered inclusive of tax) with the app on @tallyui/* 3.20.1. Each sale is rebuilt through the
// TallyUI functions useSale calls (components/sale-screen.tsx), sent through the app's real orderTransport with only
// fetch stubbed, and checked against what the store received and the order total WooCommerce stored.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ServerCapabilities, StoreSettings, SyncContext } from '@tallyui/core';
import {
  addEntryToCart, catalogueEntries, createOrderBuilder, createTaxContext, finalizeOrder, taxProviderProps,
  toOrderCreateEnvelope, woocommerceDiscountCodes,
} from '@tallyui/pos';
import { createWooCommerceConnector, wooStoreSettings } from '@tallyui/connector-woocommerce';
import { parseDiscount } from '@tallyui/components';
import type { Session } from '../lib/auth/session';
import { orderTransport } from '../lib/sale/order-transport';
import store from './fixtures/inclusive-matrix/store.json';
import plain from './fixtures/inclusive-matrix/plain.json';
import tillDiscount from './fixtures/inclusive-matrix/till-discount.json';
import coupon from './fixtures/inclusive-matrix/coupon.json';
import tillDiscountCoupon from './fixtures/inclusive-matrix/till-discount-coupon.json';
import mixed from './fixtures/inclusive-matrix/mixed.json';
import percentCoupon from './fixtures/inclusive-matrix/percent-coupon.json';

type SaleCoupon = woocommerceDiscountCodes.SaleCoupon;
interface Meta { key: string; value: unknown }
interface PostedLine { product_id: number; quantity: number; subtotal: string; total: string; meta_data?: Meta[] }
interface PostedPayload {
  status: string; set_paid: boolean; currency: string; payment_method: string; payment_method_title: string;
  line_items: PostedLine[]; coupon_lines?: unknown[]; fee_lines?: unknown[];
}
interface Row {
  row: string;
  cart: { product_id: number; sku: string; quantity: number }[];
  tillDiscount: { type: 'fixed'; amount: string; scope: 'order' } | null;
  coupon: string | null;
  chargedMinor: number;
  posted: { payload: PostedPayload };
  response: { status: number; json: { document: { id: number; number: string } } };
  woo: { total: string };
}
interface ProductDoc { id: number; categories: { id: number }[] }

const rows = {
  plain, 'till-discount': tillDiscount, coupon, 'till-discount-coupon': tillDiscountCoupon, mixed,
  'percent-coupon': percentCoupon,
} as unknown as Record<string, Row>;
const capabilities = store.capabilities as ServerCapabilities;
const products = store.products as unknown as ProductDoc[];
const coupons = store.coupons as unknown as Record<string, SaleCoupon>;

const session: Session = {
  site: {
    name: 'Shop', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
    wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/',
  },
  tokens: {
    accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000,
    user: { id: 2, uuid: 'cashier', displayName: 'Paul' },
  },
};
const fetchStub = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(row: Row) {
  fetchStub.mockImplementation(async (input) => {
    const url = String(input);
    const path = new URL(url).pathname;
    if (path.endsWith('/stores')) return Response.json(store.stores);
    if (path.endsWith('/taxes/classes')) return Response.json(store.taxClasses);
    if (path.endsWith('/taxes')) return Response.json(store.taxes);
    if (path.endsWith('/push/orders')) {
      return new Response(JSON.stringify(row.response.json), { status: row.response.status });
    }
    throw new Error('unexpected fetch ' + url);
  });
}

async function settingsFor(): Promise<StoreSettings> {
  const context: SyncContext = { connectorId: 'woocommerce', baseUrl: session.site.wcposApiUrl, headers: {} };
  // useStoreSettings puts the capabilities' taxRounding onto the connector's settings.
  return { ...(await wooStoreSettings(context)), taxRounding: capabilities.taxRounding };
}

const lineFigures = (lines: PostedLine[]) =>
  lines.map(({ product_id, quantity, subtotal, total }) => ({ product_id, quantity, subtotal, total }));

test.each(['plain', 'till-discount', 'coupon', 'till-discount-coupon', 'mixed', 'percent-coupon'])(
  '%s: charge equals the stored Woo total',
  async (name) => {
    const row = rows[name]!;
    respond(row);
    const settings = await settingsFor();
    expect(settings.pricesIncludeTax).toBe(true);

    // <TaxProvider {...taxProviderProps(settings)}> gives useSale this context through useTax().
    const taxContext = createTaxContext(taxProviderProps(settings));
    const builder = createOrderBuilder({ currency: 'USD', taxContext });
    const connector = createWooCommerceConnector();

    // sale-screen.tsx:354, then useSale.add, once per tile click; categories is useSale.add's side map for coupons.
    const categories = new Map<number, { id: number }[]>();
    for (const { product_id, quantity } of row.cart) {
      const p = products.find(doc => doc.id === product_id)!;
      expect(p).toBeDefined();
      const [entry] = catalogueEntries([p], connector.traits.product, { currency: 'USD' });
      for (let i = 0; i < quantity; i++) addEntryToCart(builder, entry!, connector.traits.product, 'USD');
      categories.set(product_id, p.categories.map(c => ({ id: c.id })));
    }

    // DiscountForm "Order discount" -> cart-add-menu.tsx:89 sale.applyDiscount(null, d) -> applyOrderDiscount.
    if (row.tillDiscount) {
      const d = parseDiscount('fixed', row.tillDiscount.amount, 'USD');
      expect(d).toEqual({ type: 'fixed', value: 137 });
      if (typeof d === 'string') throw new Error(d);
      const before = new Set(builder.getSnapshot().discounts.map(entry => entry.id));
      builder.applyOrderDiscount(d);
      const added = builder.getSnapshot().discounts.find(entry => !before.has(entry.id));
      // useSale.applyDiscount's guard: a fixed discount larger than the order is removed.
      expect(added?.amountMinor).toBe(d.value);
    }

    // useSale.applyCoupon, with the app's own discount codes and only the RxDB coupon source replaced.
    if (row.coupon) {
      const code = row.coupon;
      const codes = woocommerceDiscountCodes.createDiscountCodes({
        find: async c => coupons[c] ?? null,
        productCategories: async () => new Map(),
      });
      expect(codes.supports({ capabilities, rounding: taxContext.rounding })).toBe(true);
      const state = (accepted: ReadonlyMap<string, SaleCoupon>) => ({
        order: builder.getSnapshot(), accepted, categories,
        settings: { calcDiscountsSequentially: settings.calcDiscountsSequentially },
      });
      const found = await codes.find(code, state(new Map()));
      if (!('found' in found)) throw new Error(`coupon ${code} refused: ${found.refusal}`);
      expect(codes.check(code, found.found, state(new Map()))).toBeNull();
      codes.apply(builder, state(new Map([[code, found.found]])));
    }

    builder.addPayment({ method: 'cash', amountMinor: builder.getSnapshot().totalMinor });
    // The sale screen's REGISTER_ID and String(session.tokens.user.id); base tax, no customer, so no taxLocation.
    const order = finalizeOrder(builder.getSnapshot(), { registerId: 'web', cashierRef: '2', capabilities });
    // The outbox's first send at the store's order.create maximum (PR #275).
    const envelope = toOrderCreateEnvelope(order, 'test-device', 1, { maxVersion: capabilities.orderCreate });
    // The same two getters lib/sale/outbox-context.tsx passes.
    const result = await orderTransport(
      session, () => 't1', () => capabilities.multiplePayments === true, () => capabilities.coupons === true,
    ).send([envelope], { local: { orders: new Map([[envelope.id, order]]) } });

    const pushCalls = fetchStub.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/push/orders'));
    expect(pushCalls).toHaveLength(1);
    const { payload } = JSON.parse(pushCalls[0]![1]!.body as string) as { payload: PostedPayload };
    const recorded = row.posted.payload;

    // (a) line figures
    expect(lineFigures(payload.line_items)).toEqual(lineFigures(recorded.line_items));
    // (b) the _woocommerce_pos_data meta, present only on coupon rows
    payload.line_items.forEach((line, i) => {
      expect((line.meta_data ?? []).filter(m => m.key === '_woocommerce_pos_data'))
        .toEqual(recorded.line_items[i]!.meta_data ?? []);
    });
    // (c) coupon and fee lines
    expect(payload.coupon_lines ?? []).toEqual(recorded.coupon_lines ?? []);
    expect(payload.fee_lines ?? []).toEqual([]);
    // (d) order fields
    for (const key of ['status', 'set_paid', 'currency', 'payment_method', 'payment_method_title'] as const) {
      expect(payload[key]).toEqual(recorded[key]);
    }
    // (e) the till's charge
    expect(builder.getSnapshot().totalMinor).toBe(row.chargedMinor);
    expect(envelope.payload.totalMinor).toBe(row.chargedMinor);
    // (f) the order Woo stored totals what the till charged
    expect(Math.round(Number(row.woo.total) * 100)).toBe(row.chargedMinor);
    // (g) applied, with no warnings: the transport saw no total_mismatch
    expect(result).toEqual({
      kind: 'results',
      results: [{
        id: envelope.id, status: 'applied',
        serverRefs: {
          orderId: String(row.response.json.document.id), displayId: row.response.json.document.number,
          totalMinor: row.chargedMinor,
        },
      }],
    });
  },
);
