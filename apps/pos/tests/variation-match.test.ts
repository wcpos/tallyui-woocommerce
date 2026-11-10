import { expect, test } from 'vitest';
import type { VariantSummary } from '@tallyui/core';
import { anyPicks, pickerState, variationStockText } from '../lib/catalogue/variation-match';

const size = { name: 'Size', values: ['S', 'M'] };
const colour = { name: 'Colour', values: ['Black', 'White'] };

function variant(id: string, options: Record<string, string>): VariantSummary {
  return { id, title: Object.values(options).join(' / '), options, prices: [], stock: { status: 'in_stock', quantity: 10 } };
}

const sBlack = variant('104', { Size: 'S', Colour: 'Black' });
const sWhite = variant('105', { Size: 'S', Colour: 'White' });
const mBlack = variant('106', { Size: 'M', Colour: 'Black' });

test('counts each value against the other choices', () => {
  const state = pickerState([size, colour], [sBlack, sWhite, mBlack], {});
  expect(state.groups[0].counts).toEqual({ S: 2, M: 1 });
  expect(state.groups[1].counts).toEqual({ Black: 2, White: 1 });
  expect(state.groups[0].selected).toBeUndefined();
  expect(state.groups[1].selected).toBeUndefined();
  expect(state.selection).toEqual({});
  expect(state.matches).toHaveLength(3);
});

test('a sole viable value auto-selects but does not narrow the matches', () => {
  const state = pickerState([size, colour], [sBlack, sWhite, mBlack], { Size: 'M' });
  expect(state.groups[0].selected).toBe('M');
  expect(state.groups[0].counts).toEqual({});
  expect(state.groups[1].selected).toBe('Black');
  expect(state.groups[1].counts).toEqual({ Black: 1, White: 0 });
  expect(state.selection).toEqual({ Size: 'M', Colour: 'Black' });
  expect(state.matches).toEqual([mBlack]);
});

test('an Any variant keeps every value viable and auto-selects nothing', () => {
  const sAny = variant('110', { Size: 'S' });
  const state = pickerState([size, colour], [sAny, mBlack], { Size: 'S' });
  expect(state.groups[1].counts).toEqual({ Black: 1, White: 1 });
  expect(state.groups[1].selected).toBeUndefined();
  expect(state.matches).toEqual([sAny]);
});

test('an impossible choice matches nothing', () => {
  const state = pickerState([size, colour], [sBlack, sWhite, mBlack], { Size: 'M', Colour: 'White' });
  expect(state.matches).toEqual([]);
});

test('anyPicks sends only the open local groups', () => {
  const brand = { id: '3', name: 'Brand', values: ['Acme'] };
  const v = variant('110', { Size: 'S' });
  expect(anyPicks([size, colour, brand], v, { Size: 'S', Colour: 'White', Brand: 'Acme' })).toEqual({ Colour: 'White' });
  expect(anyPicks([size, colour, brand], v, { Size: 'S' })).toBeUndefined();
  expect(anyPicks([size, colour], v, { Colour: 'Pink' })).toBeUndefined();
});

test('stock text follows the v2 badge', () => {
  expect(variationStockText({ status: 'out_of_stock', quantity: 0 })).toBe('Out of Stock');
  expect(variationStockText({ status: 'backorder', quantity: -2 })).toBe('On Backorder');
  expect(variationStockText({ status: 'in_stock', quantity: 7 })).toBe('7 in stock');
  expect(variationStockText({ status: 'in_stock' })).toBeNull();
  expect(variationStockText({ status: 'unknown' })).toBeNull();
});
