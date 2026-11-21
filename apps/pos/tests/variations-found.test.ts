import { expect, test } from 'vitest';
import { foundVariations, variationFound, variationsFoundFor, variationsFoundLabel } from '../components/product-attributes';

test('variations found counts SKU or barcode matches with a trimmed, case-insensitive term', () => {
  const variants = [{ sku: 'MER-TEE-S-BLK', barcode: '2000000000138' }, { sku: 'MER-TEE-S-WHT' }, {}];
  expect(variationsFoundFor(variants, ' mer-tee-s ')).toBe(2);
  expect(variationsFoundFor(variants, '2000000000138')).toBe(1);
  expect(variationsFoundFor(variants, 'zzz')).toBe(0);
  expect(variationsFoundFor(variants, '')).toBe(0);
  expect(variationsFoundFor(variants, '   ')).toBe(0);
});

test('variations found labels use singular and plural counts', () => {
  expect(variationsFoundLabel(1, 'ABC')).toBe('1 variation found for "ABC"');
  expect(variationsFoundLabel(2, 'ABC')).toBe('2 variations found for "ABC"');
});

test('one variation is found by SKU or barcode, but not without a term', () => {
  expect(variationFound({ sku: 'MER-TEE-S-BLK' }, 'tee-s')).toBe(true);
  expect(variationFound({ barcode: '2000000000138' }, '0138')).toBe(true);
  expect(variationFound({ sku: 'X' }, '')).toBe(false);
});

test('found variations returns matching items, or all items when none match, in a new array', () => {
  const items = [{ sku: 'A-1' }, { sku: 'A-2' }, { sku: 'B-1' }];
  for (const term of ['a-', 'zzz', '']) {
    const found = foundVariations(items, term, item => item);
    expect(found).toEqual(term === 'a-' ? items.slice(0, 2) : items);
    expect(found).not.toBe(items);
  }
});
