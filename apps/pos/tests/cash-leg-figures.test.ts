import { describe, expect, test } from 'vitest';
import type { Payment } from '@tallyui/pos';
import { cashLegFigures } from '../lib/sale/cash-leg-figures';

const cash = (id: string, amountMinor: number): Payment => ({ id, method: 'cash', amountMinor });
const card = (id: string, amountMinor: number): Payment => ({ id, method: 'card', amountMinor });

describe('cashLegFigures', () => {
  test('one cash leg over the total keeps the change on it', () => {
    expect(cashLegFigures([cash('c', 2000)], 800).get('c')).toEqual({ amountMinor: 1200, tenderedMinor: 2000, changeMinor: 800 });
  });

  test('a card leg then a cash leg: the cash leg carries the change', () => {
    const figures = cashLegFigures([card('k', 1000), cash('c', 2000)], 1800);
    expect(figures.get('c')).toEqual({ amountMinor: 200, tenderedMinor: 2000, changeMinor: 1800 });
    expect(figures.get('k')).toEqual({ amountMinor: 1000 });
    expect(figures.get('k')?.tenderedMinor).toBeUndefined();
  });

  test('two cash legs: the last takes all the change, the first stays plain', () => {
    const figures = cashLegFigures([cash('a', 500), cash('b', 1000)], 300);
    expect(figures.get('b')).toEqual({ amountMinor: 700, tenderedMinor: 1000, changeMinor: 300 });
    expect(figures.get('a')).toEqual({ amountMinor: 500 });
    expect(figures.get('a')?.tenderedMinor).toBeUndefined();
  });

  test('change beyond the last cash leg spills onto the earlier one', () => {
    const figures = cashLegFigures([cash('a', 300), card('k', 500), cash('b', 200)], 400);
    expect(figures.get('b')).toEqual({ amountMinor: 0, tenderedMinor: 200, changeMinor: 200 });
    expect(figures.get('a')).toEqual({ amountMinor: 100, tenderedMinor: 300, changeMinor: 200 });
    expect(figures.get('k')).toEqual({ amountMinor: 500 });
  });

  test('a saved leg keeps its own figures', () => {
    const saved: Payment = { id: 's', method: 'cash', amountMinor: 1650, tenderedMinor: 2000, changeMinor: 350 };
    // Finalize already moved its change out, so the leg is not walked again even with change still passed in.
    expect(cashLegFigures([saved], 350).get('s')).toEqual({ amountMinor: 1650, tenderedMinor: 2000, changeMinor: 350 });
  });
});
