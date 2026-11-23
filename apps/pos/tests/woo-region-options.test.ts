import { expect, test } from 'vitest';
import { WOO_COUNTRY_OPTIONS, wooStatesFor } from '../lib/settings/woo-region-options';
import { WOO_REGIONS } from '../lib/settings/woo-regions';

test('country options include Australia and every WooCommerce country', () => {
  expect(WOO_COUNTRY_OPTIONS).toContainEqual({ value: 'AU', label: 'Australia' });
  expect(WOO_COUNTRY_OPTIONS).toHaveLength(Object.keys(WOO_REGIONS).length);
});

test('Australian state options include NSW', () => {
  expect(wooStatesFor('AU')).toContainEqual(expect.objectContaining({ value: 'NSW' }));
});

test('countries without states and unknown countries have no state options', () => {
  expect(wooStatesFor('AF')).toBeUndefined();
  expect(wooStatesFor('ZZ')).toBeUndefined();
});
