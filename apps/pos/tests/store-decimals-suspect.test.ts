// Money verify suspect 1 (fable-reviews-2026-11-23/tallyui-money-verify.md): a USD store whose
// woocommerce_price_num_decimals is 0. The connector only warns (wooStoreSettings: "WooCommerce price_num_decimals is 0;
// the till rounds USD to 2 digits"). WooCommerce 11.1.1 core rounds the line tax and the order total to the store's
// decimals (abstract-wc-order.php update_taxes:2282 round_line_tax -> wc_round_tax_total at wc_get_price_decimals();
// calculate_totals:2436 total rounded at $price_decimals), so 9.99 + 10% stores tax "1" and total "11".
// The bar: the till refuses to sell on this store, or it completes at the total Woo stores. Built like
// inclusive-order-matrix.test.ts: the TallyUI functions useSale calls, the app's real orderTransport, fetch stubbed.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ServerCapabilities, StoreSettings, SyncContext } from '@tallyui/core';
import {
  addEntryToCart, catalogueEntries, createOrderBuilder, createTaxContext, finalizeOrder, taxProviderProps,
  toOrderCreateEnvelope,
} from '@tallyui/pos';
import { createWooCommerceConnector, wooStoreSettings } from '@tallyui/connector-woocommerce';
import type { Session } from '../lib/auth/session';
import { orderTransport } from '../lib/sale/order-transport';
import fixture from './fixtures/inclusive-matrix/store.json';

const WOO_TOTAL = '11'; // what WooCommerce stores for this basket at 0 decimals (see the header)
const stores = [{ ...fixture.stores[0], price_num_decimals: 0, prices_include_tax: 'no' }];
const taxes = [{ ...fixture.taxes[0], id: 1, rate: '10.0000', name: 'Tax', postcode: '', postcodes: [] }];
const product = { ...fixture.products.find(p => p.id === 318)!, id: 900, price: '9.99', regular_price: '9.99' };
const capabilities = fixture.capabilities as ServerCapabilities;
const session: Session = {
  site: {
    name: 'Shop', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
    wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/',
  },
  tokens: { accessToken: 't1', refreshToken: 'r', expiresAt: 2000000000, user: { id: 2, uuid: 'c', displayName: 'Paul' } },
};
const fetchStub = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(wcposVersion: string) {
  fetchStub.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/stores')) return Response.json(stores);
    if (path.endsWith('/taxes/classes')) return Response.json(fixture.taxClasses);
    if (path.endsWith('/taxes')) return Response.json(taxes);
    if (path.endsWith('/site')) return Response.json({ wcpos_version: wcposVersion });
    if (path.endsWith('/push/orders')) {
      return Response.json({ document: { id: 410, number: '410', total: WOO_TOTAL }, currentRevision: 'r1' }, { status: 201 });
    }
    if (path.endsWith('/orders/410/payments')) return Response.json({ revision: 'r2' }, { status: 201 });
    throw new Error('unexpected fetch ' + String(input));
  });
}

test.each([['single-payment push (1.10.20)', '1.10.20'], ['ledger push (2.0.3)', '2.0.3']])(
  '0-decimal USD store, %s: the till refuses or charges what Woo stores',
  async (_name, wcposVersion) => {
    respond(wcposVersion);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context: SyncContext = { connectorId: 'woocommerce', baseUrl: session.site.wcposApiUrl, headers: {} };
    // useStoreSettings puts the capabilities' taxRounding onto the connector's settings.
    const read = await wooStoreSettings(context).then(s => s, () => null);
    if (read === null) return; // the till refuses to sell on this store: the bar is met
    const settings: StoreSettings = { ...read, taxRounding: capabilities.taxRounding };
    expect(settings.pricesIncludeTax).toBe(false);

    const connector = createWooCommerceConnector();
    const builder = createOrderBuilder({ currency: 'USD', taxContext: createTaxContext(taxProviderProps(settings)) });
    const [entry] = catalogueEntries([product], connector.traits.product, { currency: 'USD' });
    addEntryToCart(builder, entry!, connector.traits.product, 'USD');
    builder.addPayment({ method: 'cash', amountMinor: builder.getSnapshot().totalMinor });
    const order = finalizeOrder(builder.getSnapshot(), { registerId: 'web', cashierRef: '2', capabilities });
    const envelope = toOrderCreateEnvelope(order, 'test-device', 1, { maxVersion: capabilities.orderCreate });
    const result = await orderTransport(session, () => 't1', () => true, () => true)
      .send([envelope], { local: { orders: new Map([[envelope.id, order]]) } });

    const push = fetchStub.mock.calls.find(([input]) => String(input).endsWith('/push/orders'));
    const posted = (JSON.parse(push![1]!.body as string) as { payload: { status: string; set_paid?: boolean } }).payload;
    const outcome = result.kind === 'results' ? result.results[0] : result;
    console.info(JSON.stringify({ wcposVersion, warned: warn.mock.calls.map(c => String(c[0])), tillMinor: envelope.payload.totalMinor,
      posted: { status: posted.status, set_paid: posted.set_paid }, outcome }));
    // Completed at Woo's total: applied, no warning, and the till charged what the store holds.
    const wooMinor = Math.round(Number(WOO_TOTAL) * 100);
    expect({ tillMinor: envelope.payload.totalMinor, outcome }).toEqual({
      tillMinor: wooMinor,
      outcome: { id: envelope.id, status: 'applied', serverRefs: { orderId: '410', displayId: '410', totalMinor: wooMinor } },
    });
  },
);
