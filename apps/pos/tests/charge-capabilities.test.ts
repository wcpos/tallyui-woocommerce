import { expect, test } from 'vitest';
import { holdCharges } from '../lib/sale/charge-capabilities';

test('holdCharges clamps orderCreate to 3 and keeps the other capabilities', () => {
  expect(holdCharges({
    orderCreate: 5,
    multiplePayments: true,
    lineTax: { none: true, classes: true },
    taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
  })).toEqual({
    orderCreate: 3,
    multiplePayments: true,
    lineTax: { none: true, classes: true },
    taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
  });
  expect(holdCharges({ orderCreate: 2 })).toEqual({ orderCreate: 2 });
  expect(holdCharges(undefined)).toBeUndefined();
});
