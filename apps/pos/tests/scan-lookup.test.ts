import { expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { lookupCode } from '../lib/scan/lookup';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const traits = createWooCommerceConnector().traits.product;
const context = { currency: 'USD' };
const shirt = { ...products[2], variation_docs: variations.documents.filter(d => d.parent_id === products[2].id)
  .map(d => ({ ...d.payload, barcode: d.payload.global_unique_id })) };
const catalogue = [products[0], products[1], shirt];

test('finds Espresso by barcode', () => {
  expect(lookupCode(catalogue, traits, '2000000000015', context)).toMatchObject({
    kind: 'entry', entry: { product: { id: 80 } },
  });
});

test('finds Espresso by trimmed, case-insensitive SKU', () => {
  expect(lookupCode(catalogue, traits, ' cof-esp ', context)).toMatchObject({
    kind: 'entry', entry: { product: { id: 80 } },
  });
});

test('finds a specific variation by barcode', () => {
  expect(lookupCode(catalogue, traits, '2000000000138', context)).toMatchObject({
    kind: 'entry', entry: { product: { id: 102 }, variant: { id: '104' } },
  });
});

test.each(['2000000000121', 'MER-TEE'])('finds a variable parent by its own code %s', code => {
  expect(lookupCode(catalogue, traits, code, context)).toMatchObject({ kind: 'product', product: { id: 102 } });
});

test.each(['999', ''])('returns none for an unmatched or empty code %s', code => {
  expect(lookupCode(catalogue, traits, code, context)).toEqual({ kind: 'none' });
});

test('counts entries sharing a barcode', () => {
  expect(lookupCode([products[0], { ...products[0], id: 980 }], traits, '2000000000015', context))
    .toEqual({ kind: 'several', count: 2 });
});

test('barcode matches take precedence over SKU matches', () => {
  const coldBrew = { ...products[1], id: 900, global_unique_id: 'COF-ESP' };
  expect(lookupCode([...catalogue, coldBrew], traits, 'COF-ESP', context)).toMatchObject({
    kind: 'entry', entry: { product: { id: 900 } },
  });
});
