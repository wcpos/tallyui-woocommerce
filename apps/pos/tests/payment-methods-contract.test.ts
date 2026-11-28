// The fixture mirrors the Tally_Payment_Methods_Controller on TallyUI/woocommerce-pos tally at 66c3acc (PR #3); B-2 relies on these shapes.
import { expect, test } from 'vitest';
import { defaultPaymentMethods } from '@tallyui/core';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import fixture from './fixtures/fork-payment-methods.json';

const baseUrl = 'https://shop.example/wp-json/wcpos/v2';

async function readMethods(body: typeof fixture | null) {
  const urls: string[] = [];
  const connector = createWooCommerceConnector();
  const methods = await connector.paymentMethods!({
    connectorId: connector.id, baseUrl, headers: {}, fetch: async (input, init) => {
      const url = String(input);
      urls.push(url);
      if (body === null) return new Response(null, { status: 404 });
      expect(init?.method ?? 'GET').toBe('GET');
      if (url === `${baseUrl}/payment-methods`) return Response.json(body);
      if (url === `${baseUrl}/stores`) return Response.json([{ currency: 'usd' }]);
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  return { methods, urls };
}

test('P1 the fork maps 0.05 cash rounding, leaves card unrounded, drops disabled gateways and reads currency once', async () => {
  const { methods, urls } = await readMethods(fixture);
  expect(methods.map(method => method.id)).toEqual(['pos_cash', 'pos_card']);
  expect(methods[0]).toEqual({
    id: 'pos_cash', title: 'Cash', kind: 'cash',
    capture: { mode: 'manual', provider: null, hardware: null },
    capabilities: {
      amount: { partial: true }, change: true, void: true, refunds: { via: 'manual', partial: true },
      tips: 'none', offline: 'record',
    },
    defaults: { rounding: { incrementMinor: 5, mode: 'nearest' }, openDrawer: true },
  });
  expect(methods[1].defaults.rounding).toBeNull();
  expect(urls).toEqual([`${baseUrl}/payment-methods`, `${baseUrl}/stores`]);
});

test('P2 an unset cash increment leaves rounding null without reading store currency', async () => {
  const body = structuredClone(fixture);
  body.methods[0].defaults.rounding = null;
  const { methods, urls } = await readMethods(body);
  expect(methods[0].defaults.rounding).toBeNull();
  expect(urls).toEqual([`${baseUrl}/payment-methods`]);
});

test('P3 the fork maps a 0.10 cash increment to ten minor units', async () => {
  const body = structuredClone(fixture);
  body.methods[0].defaults.rounding = { increment: '0.10', mode: 'nearest' };
  const { methods } = await readMethods(body);
  expect(methods[0].defaults.rounding).toEqual({ incrementMinor: 10, mode: 'nearest' });
});

test('P4 a missing route on stock WCPOS returns cash and external defaults with no rounding', async () => {
  const { methods, urls } = await readMethods(null);
  expect(urls).toEqual([`${baseUrl}/payment-methods`]);
  expect(methods).toEqual(defaultPaymentMethods());
  expect(methods.map(method => [method.id, method.defaults.rounding])).toEqual([['cash', null], ['external', null]]);
});
