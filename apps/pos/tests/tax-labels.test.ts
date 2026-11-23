import { expect, test } from 'vitest';
import { taxRateLabel } from '../lib/sale/tax-labels';

const caTax = { id: 1, code: 'US-CA-CA TAX-1', label: 'CA Tax', rate: '10.0000',
  priority: 1, compound: false, shipping: true };

test('a standard rate uses its label', () => {
  expect(taxRateLabel({ taxRates: { standard: [caTax] } })(100000)).toBe('CA Tax');
});

test('an unmatched ppm uses the default label', () => {
  expect(taxRateLabel({ taxRates: { standard: [caTax] } })(50000)).toBe('Tax 5%');
});

test('different labels at the same ppm use the default label', () => {
  expect(taxRateLabel({ taxRates: {
    standard: [caTax], reduced: [{ ...caTax, id: 2, label: 'VAT' }],
  } })(100000)).toBe('Tax 10%');
});

test('a blank-named rate beside a named one at the same ppm uses the default label', () => {
  expect(taxRateLabel({ taxRates: {
    standard: [caTax], reduced: [{ ...caTax, id: 2, label: '' }],
  } })(100000)).toBe('Tax 10%');
});

test('the same label in two classes stays named', () => {
  expect(taxRateLabel({ taxRates: {
    standard: [caTax], reduced: [{ ...caTax, id: 2 }],
  } })(100000)).toBe('CA Tax');
});

test.each(['', '   '])('an empty label %j uses the default label', label => {
  expect(taxRateLabel({ taxRates: { standard: [{ ...caTax, label }] } })(100000)).toBe('Tax 10%');
});

test('undefined taxRates uses the default label', () => {
  expect(taxRateLabel({ taxRates: undefined })(100000)).toBe('Tax 10%');
});

test('a decimal rate uses its label', () => {
  expect(taxRateLabel({ taxRates: {
    standard: [{ ...caTax, rate: '8.2500' }],
  } })(82500)).toBe('CA Tax');
});
