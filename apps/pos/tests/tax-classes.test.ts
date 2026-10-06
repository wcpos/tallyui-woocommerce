import { expect, test } from 'vitest';
import { taxClassOptions } from '../lib/sale/tax-classes';

test('taxClassOptions drops standard and labels the rest', () => {
  expect(taxClassOptions(['standard', 'reduced-rate', 'zero-rate'])).toEqual([
    { id: 'reduced-rate', label: 'Reduced rate' },
    { id: 'zero-rate', label: 'Zero rate' },
  ]);
  expect(taxClassOptions(undefined)).toEqual([]);
});
