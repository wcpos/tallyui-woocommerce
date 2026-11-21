import { expect, test } from 'vitest';
import { variationsFoundFor, variationsFoundLabel } from '../components/product-attributes';

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
