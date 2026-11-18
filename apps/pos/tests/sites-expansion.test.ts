import { expect, test } from 'vitest';
import { getNextExpandedSiteHome, getNextExpansion } from '../lib/auth/sites-expansion';

test('opens the first site on mount', () => {
  expect(getNextExpansion({ homes: [], expanded: undefined }, ['a', 'b']))
    .toEqual({ homes: ['a', 'b'], expanded: 'a' });
});

test('opens a newly added site', () => {
  expect(getNextExpandedSiteHome(['a', 'b'], ['a', 'b', 'c'], 'a')).toBe('c');
  expect(getNextExpansion({ homes: ['a', 'b'], expanded: 'a' }, ['a', 'b', 'c']))
    .toEqual({ homes: ['a', 'b', 'c'], expanded: 'c' });
});

test('opens the first remaining site when the open one is removed', () => {
  expect(getNextExpandedSiteHome(['a', 'b', 'c'], ['b', 'c'], 'a')).toBe('b');
});

test('keeps the open site when the list only reorders', () => {
  expect(getNextExpandedSiteHome(['a', 'b'], ['b', 'a'], 'a')).toBe('a');
});

test('stays all folded once the cashier folds every site', () => {
  expect(getNextExpandedSiteHome(['a', 'b'], ['b', 'a'], '')).toBe('');
  expect(getNextExpandedSiteHome(['a', 'b', 'c'], ['a', 'b'], '')).toBe('');
});

test('returns the same state when the homes are unchanged', () => {
  const state = { homes: ['a', 'b'], expanded: 'b' };
  expect(getNextExpansion(state, ['a', 'b'])).toBe(state);
});
