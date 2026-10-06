import { expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { resolvePrice } from '@tallyui/core';
import { simpleEntry } from '../lib/sale/simple-entry';
import products from './fixtures/products.json';

const traits = createWooCommerceConnector().traits.product;

test('Espresso is its own variant with a USD price in minor units', () => {
  const entry = simpleEntry(products[0], traits, 'USD');
  expect(entry?.product).toBe(products[0]);
  expect(entry?.variant.id).toBe('80');
  expect(entry?.variant.sku).toBe('COF-ESP');
  expect(resolvePrice(entry!.variant.prices, 'USD')?.current).toEqual({ amount: 300, currency: 'USD' });
});

test('T-Shirt needs variation selection', () => {
  expect(simpleEntry(products[2], traits, 'USD')).toBeNull();
});
