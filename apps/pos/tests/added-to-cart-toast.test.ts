import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { showAddedToCartToast } from '../lib/toast/added-to-cart-toast';
import { dismissToast, getToasts } from '../lib/toast/toast';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  dismissToast();
  vi.useRealTimers();
});

test('the first add names the product in one success toast that lasts 4000 ms', () => {
  showAddedToCartToast('Espresso');
  expect(getToasts()).toEqual([{
    id: 'pos-added-to-cart', type: 'success', title: 'Espresso added to cart', duration: 4000,
  }]);
  vi.advanceTimersByTime(3999);
  expect(getToasts()).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(getToasts()).toEqual([]);
});

test('adds within 4 s of the last add update the same toast with a count', () => {
  showAddedToCartToast('Espresso');
  vi.advanceTimersByTime(3000);
  showAddedToCartToast('Latte');
  vi.advanceTimersByTime(3000);
  showAddedToCartToast('Espresso');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-added-to-cart', title: '3 items added to cart' })]);
});

test('an add 5 s after the last one starts again at one item', () => {
  showAddedToCartToast('Espresso');
  showAddedToCartToast('Espresso');
  expect(getToasts()[0].title).toBe('2 items added to cart');
  vi.advanceTimersByTime(5000);
  showAddedToCartToast('Latte');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-added-to-cart', title: 'Latte added to cart' })]);
});

test('an add after the toast was dismissed starts again at one item', () => {
  showAddedToCartToast('Espresso');
  showAddedToCartToast('Espresso');
  dismissToast('pos-added-to-cart');
  vi.advanceTimersByTime(1000);
  showAddedToCartToast('Latte');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-added-to-cart', title: 'Latte added to cart' })]);
});
