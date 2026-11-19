import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { StoreTaxRate } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import {
  appliesCount, matchedRateIds, TaxRatesDialog, type TaxAddress, type WooTaxRate,
} from '../components/settings/tax-rates-dialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function rate(id: number, more: Partial<WooTaxRate>): WooTaxRate {
  return {
    id, country: '', state: '', postcode: '', city: '', postcodes: [], cities: [], rate: '10.0000', name: `Rate ${id}`,
    priority: 1, compound: false, shipping: true, order: 0, class: 'standard', ...more,
  };
}

function address(more: Partial<TaxAddress>): TaxAddress {
  return { country: '', state: '', city: '', postcode: '', ...more };
}

const ids = (table: WooTaxRate[], where: Partial<TaxAddress>) => [...matchedRateIds(table, address(where))];

// v2 tax-rates/rate-rows.ts:90-101: each case in its own table, so WooCommerce's one rate per priority per class hides none.
describe('matchedRateIds', () => {
  test('a country match', () => {
    expect(ids([rate(1, { country: 'US' })], { country: 'US' })).toEqual(['1']);
  });

  test('a country mismatch', () => {
    expect(ids([rate(1, { country: 'GB' })], { country: 'US' })).toEqual([]);
  });

  test('the state must match when the rate names one', () => {
    const table = [rate(1, { country: 'US', state: 'CA' })];
    expect(ids(table, { country: 'US', state: 'CA' })).toEqual(['1']);
    expect(ids(table, { country: 'US', state: 'TX' })).toEqual([]);
  });

  test('a postcode wildcard matches the prefix', () => {
    const table = [rate(1, { country: 'AU', postcodes: ['30*'] })];
    expect(ids(table, { country: 'AU', postcode: '3000' })).toEqual(['1']);
    expect(ids(table, { country: 'AU', postcode: '4000' })).toEqual([]);
  });

  test('an empty rate field matches any address', () => {
    expect(ids([rate(1, {})], { country: 'AU', state: 'VIC', city: 'Melbourne', postcode: '3000' })).toEqual(['1']);
  });

  // WooCommerce's admin takes "2000; 30*"; the REST API sends it as the list.
  test('any of several postcodes matches', () => {
    const table = [rate(1, { country: 'AU', postcodes: ['2000', '30*'] })];
    expect(ids(table, { country: 'AU', postcode: '2000' })).toEqual(['1']);
    expect(ids(table, { country: 'AU', postcode: '3001' })).toEqual(['1']);
    expect(ids(table, { country: 'AU', postcode: '2600' })).toEqual([]);
  });

  test('one rate per priority per class, as WooCommerce applies', () => {
    const table = [rate(1, { country: 'US' }), rate(2, { country: 'US', state: 'CA' })];
    expect(ids(table, { country: 'US', state: 'CA' })).toEqual(['2']);
  });
});

test('appliesCount reads v2\'s copy', () => {
  expect(appliesCount(0, 'AU')).toBe('none apply to this address (AU)');
  expect(appliesCount(1, 'AU')).toBe('1 applies to this address (AU)');
  expect(appliesCount(2, 'AU')).toBe('2 apply to this address (AU)');
  expect(appliesCount(0, '')).toBe('none apply to this address');
  expect(appliesCount(1, '')).toBe('1 applies to this address');
  expect(appliesCount(2, '')).toBe('2 apply to this address');
});

// The store's table and the sheet's list of the same three rates: GST (AU), a Victorian levy at priority 2, UK VAT.
const table = [
  rate(1, { country: 'AU', name: 'GST' }),
  rate(2, { country: 'AU', state: 'VIC', name: 'Levy', priority: 2 }),
  rate(3, { country: 'GB', name: 'VAT' }),
];
const allTaxRates: StoreTaxRate[] = [
  { id: '1', name: 'GST', rate: '10.0000', taxClass: 'standard', priority: 1, location: { country: 'AU' } },
  { id: '2', name: 'Levy', rate: '10.0000', taxClass: 'standard', priority: 2, location: { country: 'AU', region: 'VIC' } },
  { id: '3', name: 'VAT', rate: '10.0000', taxClass: 'standard', priority: 1, location: { country: 'GB' } },
];

function openSheet(width: number, more: { address?: TaxAddress; rateTable?: WooTaxRate[] }) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  render(<><TaxRatesDialog rates={allTaxRates} taxClassSlugs={[]} onClose={vi.fn()} {...more} /><PortalHost /></>);
}
const marked = (id: string) => screen.getByTestId(`tax-rates-row-${id}`).getAttribute('aria-selected');
const count = () => screen.getByTestId('tax-rates-count').textContent;

test('the sheet opened with an address marks exactly the matching rows and counts them', () => {
  openSheet(1000, { address: address({ country: 'AU', state: 'VIC' }), rateTable: table });
  expect([marked('1'), marked('2'), marked('3')]).toEqual(['true', 'true', null]);
  expect(count()).toBe('3 tax rates · 2 apply to this address (AU)');
});

test('none apply: no row marked, and the footer says so', () => {
  openSheet(1000, { address: address({ country: 'AU', state: 'VIC' }), rateTable: [table[2]!] });
  expect([marked('1'), marked('2'), marked('3')]).toEqual([null, null, null]);
  expect(count()).toBe('3 tax rates · none apply to this address (AU)');
});

test('a phone marks the list rows too', () => {
  openSheet(390, { address: address({ country: 'AU', state: 'VIC' }), rateTable: table });
  expect(screen.getByTestId('tax-rates-list')).not.toBeNull();
  expect([marked('1'), marked('2'), marked('3')]).toEqual(['true', 'true', null]);
});

test('without an address the sheet has no marks and the plain count', () => {
  openSheet(1000, {});
  expect([marked('1'), marked('2'), marked('3')]).toEqual([null, null, null]);
  expect(count()).toBe('3 tax rates');
});
