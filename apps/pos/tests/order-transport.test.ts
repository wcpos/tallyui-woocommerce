import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => { vi.unstubAllGlobals(); });

test('acceptsCoupons true sends coupon_lines with the coupon code', async () => {
  envelope = couponEnvelope;
  await orderTransport(session, () => 't1', undefined, true).send([envelope]);
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.coupon_lines).toEqual([{ code: 'save10' }]);
});

test.each([undefined, () => false])('without acceptsCoupons a coupon order is rejected as coupons_unsupported and nothing is sent', async acceptsCoupons => {
  envelope = couponEnvelope;
  const transport = acceptsCoupons === undefined
    ? orderTransport(session, () => 't1') : orderTransport(session, () => 't1', undefined, acceptsCoupons);
  await expect(transport.send([envelope])).resolves.toMatchObject({
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
