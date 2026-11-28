import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readWooCapabilities } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import { woocommerceCoupons } from '@tallyui/core';
import { createOrderBuilder, finalizeOrder, toOrderCreateEnvelope } from '@tallyui/pos';
import type { Session } from '../lib/auth/session';
import { CashierChangedError, orderTransport, ownerToken } from '../lib/sale/order-transport';

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
let envelope: OrderCreateEnvelope;
let couponEnvelope: OrderCreateEnvelope;
let siteVersion: string | undefined;
let statusCapabilities: string[] | undefined;
let siteHttp = 200;
let statusHttp = 200;

beforeEach(() => {
  const builder = createOrderBuilder({
    currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
  });
  builder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  builder.addPayment({ method: 'cash', amountMinor: 600 });
  envelope = toOrderCreateEnvelope(finalizeOrder(builder.getSnapshot()), 'test-device');
  const couponBuilder = createOrderBuilder({
    currency: 'USD', taxContext: { getTaxRatePpm: () => 0, getTaxRates: () => [], pricesIncludeTax: false,
      rounding: { granularity: 'woocommerce', roundAtSubtotal: false } },
  });
  couponBuilder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  const coupon = { id: 7, code: 'save10', discount_type: 'percent' as const, amount: '10' };
  couponBuilder.setCoupons(['save10'], {
    configs: woocommerceCoupons.toCouponConfigs(['save10'], new Map([['save10', coupon]])),
    couponIds: new Map([['save10', '7']]), productCategories: new Map(), calcDiscountsSequentially: false,
  });
  couponBuilder.addPayment({ method: 'cash', amountMinor: couponBuilder.getSnapshot().totalMinor });
  couponEnvelope = toOrderCreateEnvelope(
    finalizeOrder(couponBuilder.getSnapshot(), { capabilities: { orderCreate: 6, coupons: true } }), 'test-device',
  );
  fetchStub.mockReset().mockImplementation(async () => new Response(JSON.stringify({
    document: { id: 115, status: 'completed', total: (envelope.payload.totalMinor / 100).toFixed(6) },
    currentRevision: 'r1',
  }), { status: 201 }));
  siteVersion = '1.10.20';
  statusCapabilities = ['order_payments_list'];
  siteHttp = 200;
  statusHttp = 200;
  // connector-woocommerce 5.6.1 reads /site (ledger, coupons) and /status (split tender); answer outside fetchStub.
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0]);
    if (url.endsWith('/site')) {
      return siteHttp === 200 ? Response.json({ wcpos_version: siteVersion }) : new Response('{}', { status: siteHttp });
    }
    if (url.endsWith('/status')) {
      return statusHttp === 200 ? Response.json({ capabilities: statusCapabilities }) : new Response('{}', { status: statusHttp });
    }
    return fetchStub(...args);
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

test('acceptsCoupons true sends coupon_lines with the coupon code', async () => {
  envelope = couponEnvelope;
  await orderTransport(session, () => 't1', undefined, true).send([envelope]);
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.coupon_lines).toEqual([{ code: 'save10' }]);
});

test.each([false, () => false])('a closed acceptsCoupons gate rejects a coupon order as coupons_unsupported and nothing is sent', async acceptsCoupons => {
  envelope = couponEnvelope;
  const transport = orderTransport(session, () => 't1', undefined, acceptsCoupons);
  await expect(transport.send([envelope])).resolves.toMatchObject({
    kind: 'results', results: [{ id: envelope.id, status: 'rejected', error: {
      code: 'coupon_invalid', data: { storeCode: 'coupons_unsupported' },
    } }],
  });
  expect(fetchStub).not.toHaveBeenCalled();
});

test('without acceptsCoupons a store below WCPOS 1.9.0 rejects a coupon order as coupons_unsupported and nothing is sent', async () => {
  envelope = couponEnvelope;
  siteVersion = '1.8.9';
  await expect(orderTransport(session, () => 't1').send([envelope])).resolves.toMatchObject({
    kind: 'results', results: [{ id: envelope.id, status: 'rejected', error: {
      code: 'coupon_invalid', data: { storeCode: 'coupons_unsupported' },
    } }],
  });
  expect(fetchStub).not.toHaveBeenCalled();
});

test('a 400 woocommerce_rest_invalid_coupon is rejected as coupon_invalid with the decoded message and the code', async () => {
  envelope = couponEnvelope;
  fetchStub.mockResolvedValue(Response.json({
    code: 'woocommerce_rest_invalid_coupon', message: 'Coupon &quot;save10&quot; has <strong>expired</strong>.',
  }, { status: 400 }));
  await expect(orderTransport(session, () => 't1', undefined, true).send([envelope])).resolves.toMatchObject({
    kind: 'results', results: [{ id: envelope.id, status: 'rejected', error: {
      code: 'coupon_invalid', message: 'Coupon "save10" has expired.',
      data: { storeCode: 'woocommerce_rest_invalid_coupon', couponCode: 'save10' },
    } }],
  });
});

test('ownerToken returns the live token while the owner is the live cashier', () => {
  const live = { ...session, tokens: { ...session.tokens, accessToken: 't9' } };
  expect(ownerToken(session, () => live)()).toBe('t9');
});

test('ownerToken refuses another cashier, another site, or no session', () => {
  const cases = [
    { ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, uuid: 'other' } } },
    { ...session, site: { ...session.site, home: 'https://other.example' } },
    null,
  ];
  for (const live of cases) {
    expect(ownerToken(session, () => live)).toThrow(CashierChangedError);
  }
});

test('a transport whose cashier is no longer live sends nothing and asks to retry', async () => {
  const liveB = { ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, uuid: 'other' } } };
  const transport = orderTransport(session, ownerToken(session, () => liveB));

  await expect(transport.send([envelope])).resolves.toMatchObject({ kind: 'retry' });
  expect(fetchStub).not.toHaveBeenCalled();
});

test('posts an order.create envelope to the WCPOS push endpoint with authenticated headers', async () => {
  await orderTransport(session, () => 't1').send([envelope]);

  expect(fetchStub).toHaveBeenCalledTimes(1);
  expect(fetchStub).toHaveBeenCalledWith('https://shop.example/wp-json/wcpos/v2/push/orders', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer t1', 'X-WCPOS': '1' }),
  }));
  expect(JSON.parse(fetchStub.mock.calls[0][1]!.body as string)).toMatchObject({
    mutationId: envelope.id, operation: 'create', collection: 'orders',
    recordId: envelope.payload.clientOrderId, baseRevision: null,
    payload: { status: 'completed', set_paid: true, payment_method: 'pos_cash' },
  });
});

test('reads the latest access token for each send on the same transport', async () => {
  let token = 't1';
  const transport = orderTransport(session, () => token);
  await transport.send([envelope]);
  token = 't2';
  await transport.send([envelope]);

  expect(fetchStub).toHaveBeenCalledTimes(2);
  expect(fetchStub.mock.calls[0][1]!.headers).toMatchObject({ Authorization: 'Bearer t1' });
  expect(fetchStub.mock.calls[1][1]!.headers).toMatchObject({ Authorization: 'Bearer t2' });
});

test('maps a real-shaped WCPOS 1.10.20 push response to the applied envelope id', async () => {
  expect(envelope.payload.totalMinor).toBe(600);
  await expect(orderTransport(session, () => 't1').send([envelope])).resolves.toEqual({
    kind: 'results',
    results: [{ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', displayId: '115', totalMinor: 600 } }],
  });
});

test('pushes a discounted line with subtotal equal to total (ADR-077a)', async () => {
  const builder = createOrderBuilder({
    currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
  });
  const lineId = builder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  builder.applyLineDiscount(lineId, { type: 'fixed', value: 100 });
  builder.addPayment({ method: 'cash', amountMinor: 500 });
  envelope = toOrderCreateEnvelope(
    finalizeOrder(builder.getSnapshot(), { capabilities: { orderCreate: 3 } }), 'test-device',
  );
  expect(envelope.payload.totalMinor).toBe(500);
  await expect(orderTransport(session, () => 't1').send([envelope])).resolves.toEqual({
    kind: 'results',
    results: [{ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', displayId: '115', totalMinor: 500 } }],
  });
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.line_items).toEqual([
    { product_id: 80, quantity: 2, subtotal: '5.00', total: '5.00' },
  ]);
});

test('pushes an inclusive discounted line with subtotal equal to total at the net', async () => {
  const builder = createOrderBuilder({
    currency: 'USD', taxContext: {
      getTaxRatePpm: () => 100000, pricesIncludeTax: true,
      rounding: { granularity: 'woocommerce', roundAtSubtotal: false },
      getTaxRates: () => [{ id: 1, code: 'US-TAX-1', label: 'Tax', rate: '10.0000', priority: 1, compound: false, shipping: true }],
    },
  });
  const lineId = builder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  builder.applyLineDiscount(lineId, { type: 'fixed', value: 100 });
  builder.addPayment({ method: 'cash', amountMinor: 500 });
  const order = finalizeOrder(builder.getSnapshot(), { capabilities: { orderCreate: 3 } });
  envelope = toOrderCreateEnvelope(order, 'test-device');
  expect(envelope.payload.totalMinor).toBe(500);
  await expect(orderTransport(session, () => 't1').send([envelope], { local: { orders: new Map([[envelope.id, order]]) } })).resolves.toEqual({
    kind: 'results',
    results: [{ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', displayId: '115', totalMinor: 500 } }],
  });
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.line_items).toEqual([
    { product_id: 80, quantity: 2, subtotal: '4.545455', total: '4.545455' },
  ]);
});

test.each([true, false])('sends two tenders only with acceptsPaymentsList=%s', async acceptsPaymentsList => {
  envelope.payload.payments = [
    { clientPaymentId: 'cash', method: 'cash', amountMinor: 200 },
    { clientPaymentId: 'card', method: 'external', amountMinor: 400 },
  ];
  const result = await orderTransport(session, () => 't1', acceptsPaymentsList).send([envelope]);
  if (!acceptsPaymentsList) {
    expect(result).toEqual({ kind: 'results', results: [{ id: envelope.id, status: 'rejected', error: {
      code: 'invalid_payload', message: 'WooCommerce orders take one payment.',
    } }] });
    expect(fetchStub).not.toHaveBeenCalled();
    return;
  }
  expect(result).toEqual({ kind: 'results', results: [{ id: envelope.id, status: 'applied',
    serverRefs: { orderId: '115', displayId: '115', totalMinor: 600 },
  }] });
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.payment_method).toBe('pos_card');
  const payments = payload.meta_data.find((entry: { key: string }) => entry.key === '_woocommerce_pos_payments');
  expect(JSON.parse(payments.value)).toEqual([
    { method: 'pos_cash', title: 'Cash', amount: '2.00' },
    { method: 'pos_card', title: 'Card', amount: '4.00' },
  ]);
});

test('two tenders are rejected when the store does not advertise order_payments_list', async () => {
  statusCapabilities = [];
  envelope.payload.payments = [
    { clientPaymentId: 'cash', method: 'cash', amountMinor: 200 },
    { clientPaymentId: 'card', method: 'external', amountMinor: 400 },
  ];
  await expect(orderTransport(session, () => 't1', true).send([envelope])).resolves.toEqual({
    kind: 'results', results: [{ id: envelope.id, status: 'rejected', error: {
      code: 'invalid_payload', message: 'WooCommerce orders take one payment.',
    } }],
  });
  expect(fetchStub).not.toHaveBeenCalled();
});

describe('ADR-094 cash rounding', () => {
  function espresso(amount: number) {
    const builder = createOrderBuilder({
      currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
    });
    builder.addLine({
      productId: '80', variantId: '80', name: 'Espresso', quantity: 1, unitPrice: { amount, currency: 'USD' },
    });
    return builder;
  }

  function roundedCashSale() {
    const builder = espresso(302);
    builder.addPayment({ method: 'cash', amountMinor: 300 }, { minor: -2 });
    return builder;
  }

  function send(builder: ReturnType<typeof createOrderBuilder>) {
    envelope = toOrderCreateEnvelope(
      finalizeOrder(builder.getSnapshot(), { capabilities: { orderCreate: 5, cashRounding: true } }), 'test-device',
    );
    return orderTransport(session, () => 't1', true).send([envelope]);
  }

  function postedPayload() {
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe(`${session.site.wcposApiUrl}/push/orders`);
    expect(init?.method).toBe('POST');
    return JSON.parse(init!.body as string).payload;
  }

  test('T1 a fork store before 2.0 gets one tax-none Rounding fee line for a negative cash entry', async () => {
    statusCapabilities = ['order_payments_list', 'order_create_v5'];
    await expect(send(roundedCashSale())).resolves.toMatchObject({ kind: 'results', results: [{ status: 'applied' }] });
    expect(postedPayload().fee_lines).toEqual([{ name: 'Rounding', total: '-0.02', tax_status: 'none', tax_class: '' }]);
  });

  test('T2 a split with cash second posts both payments and one positive Rounding fee', async () => {
    statusCapabilities = ['order_payments_list', 'order_create_v5'];
    const builder = espresso(1003);
    builder.addPayment({ method: 'external', amountMinor: 500 });
    builder.addPayment({ method: 'cash', amountMinor: 505 }, { minor: 2 });
    await expect(send(builder)).resolves.toMatchObject({ kind: 'results', results: [{ status: 'applied' }] });
    const payload = postedPayload();
    const payments = payload.meta_data.find((entry: { key: string }) => entry.key === '_woocommerce_pos_payments');
    expect(JSON.parse(payments.value)).toMatchObject([
      { method: 'pos_card', amount: '5.00' }, { method: 'pos_cash', amount: '5.05' },
    ]);
    expect(payload.fee_lines).toEqual([{ name: 'Rounding', total: '0.02', tax_status: 'none', tax_class: '' }]);
  });

  test('T3 a stock store without order_create_v5 rejects cash rounding without a POST', async () => {
    await expect(send(roundedCashSale())).resolves.toMatchObject({ kind: 'results', results: [{
      status: 'rejected', error: { code: 'invalid_payload', data: { storeCode: 'cash_rounding_unsupported' } },
    }] });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  test('T4 a fork store on WCPOS 2.0.1 rejects cash rounding without a POST', async () => {
    statusCapabilities = ['order_payments_list', 'order_create_v5'];
    siteVersion = '2.0.1';
    await expect(send(roundedCashSale())).resolves.toMatchObject({ kind: 'results', results: [{
      status: 'rejected', error: {
        code: 'invalid_payload', data: { storeCode: 'cash_rounding_unsupported' },
        message: expect.stringMatching(/^WooCommerce POS 2\.0 does not carry cash rounding/),
      },
    }] });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  test('T5 a fork store gets no Rounding fee line when there are no rounding entries', async () => {
    statusCapabilities = ['order_payments_list', 'order_create_v5'];
    const builder = espresso(302);
    builder.addPayment({ method: 'cash', amountMinor: 302 });
    await expect(send(builder)).resolves.toMatchObject({ kind: 'results', results: [{ status: 'applied' }] });
    expect(postedPayload().fee_lines).toBeUndefined();
  });

  test('T6 finalizeOrder refuses a cash rounding entry without the cashRounding capability', () => {
    const snapshot = roundedCashSale().getSnapshot();
    expect(() => finalizeOrder(snapshot, { capabilities: { orderCreate: 5 } })).toThrow(
      /cash rounding needs a store whose connector declares the cashRounding capability/,
    );
  });

  const stockCaps = ['order_payments_list'];
  const forkCaps = ['order_payments_list', 'order_create_v5'];

  test.each([
    ['C1 the connector declares cashRounding on a fork store before 2.0', '1.10.20', forkCaps, 200, true],
    ['C2 the connector omits cashRounding on a 2.0.1 fork', '2.0.1', forkCaps, 200, undefined],
    ['C3 the connector omits cashRounding on a stock store', '1.10.20', stockCaps, 200, undefined],
    ['C4 the connector omits cashRounding when /site has no version', undefined, forkCaps, 200, undefined],
    ['C5 the connector omits cashRounding when /site returns 500', '1.10.20', forkCaps, 500, undefined],
  ] as const)('%s', async (_name, version, caps, siteCode, expected) => {
    siteVersion = version;
    statusCapabilities = caps;
    siteHttp = siteCode;
    const capabilities = await readWooCapabilities({
      connectorId: 'woocommerce', baseUrl: session.site.wcposApiUrl, headers: {},
      fetch: (input, init) => String(input).endsWith('/stores')
        ? Promise.resolve(Response.json([{ currency: 'usd', prices_include_tax: 'no', tax_round_at_subtotal: 'no' }]))
        : fetch(input, init),
    });
    expect(capabilities).toBeDefined();
    expect(capabilities?.cashRounding).toBe(expected);
  });

  const unsupported = { kind: 'results', results: [{
    status: 'rejected', error: { code: 'invalid_payload', data: { storeCode: 'cash_rounding_unsupported' } },
  }] };
  test.each([
    ['R1 no version', undefined, forkCaps, 200, 200, { kind: 'retry', reason: 'store_version_unknown' }],
    ['R2 malformed version', 'tally', forkCaps, 200, 200, { kind: 'retry', reason: 'store_version_unknown' }],
    ['R3 /status returns 404', '1.10.20', forkCaps, 200, 404, { kind: 'retry', reason: 'store_status_unknown' }],
    ['R4 no capabilities array', '1.10.20', undefined, 200, 200, unsupported],
    ['R5 /site returns 500', '1.10.20', forkCaps, 500, 200, { kind: 'retry', reason: 'status_500' }],
    ['R6 fork on ledger', '2.0.1', forkCaps, 200, 200, unsupported],
  ] as const)('%s: rounded split does not POST', async (_name, version, caps, siteCode, statusCode, expected) => {
    siteVersion = version;
    statusCapabilities = caps;
    siteHttp = siteCode;
    statusHttp = statusCode;
    const builder = espresso(1003);
    builder.addPayment({ method: 'external', amountMinor: 500 });
    builder.addPayment({ method: 'cash', amountMinor: 505 }, { minor: 2 });
    await expect(send(builder)).resolves.toMatchObject(expected);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
