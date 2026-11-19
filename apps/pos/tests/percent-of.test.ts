import { expect, test } from 'vitest';
import { percentOfMinor } from '../lib/sale/percent-of';

test('25 % of 1000 minor units is 250', () => {
  expect(percentOfMinor(1000, 25)).toBe(250);
});

test('a share rounds half-up to a minor unit, as v2', () => {
  expect(percentOfMinor(1001, 33)).toBe(330);
  expect(percentOfMinor(1002, 25)).toBe(251);
  expect(percentOfMinor(1001, 50)).toBe(501);
});

test('100 % is the whole balance', () => {
  expect(percentOfMinor(1001, 100)).toBe(1001);
});

test('0 % is nothing and above 100 % is capped at the balance', () => {
  expect(percentOfMinor(2000, 0)).toBe(0);
  expect(percentOfMinor(2000, 125)).toBe(2000);
  expect(percentOfMinor(2000, -10)).toBe(0);
});
