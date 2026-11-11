import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PosPhoneTabBar } from '../components/pos-phone-tab-bar';

afterEach(cleanup);

test('the Cart badge reads New for an empty cart and the count otherwise', () => {
  const view = render(<PosPhoneTabBar active="products" onSelect={() => {}} cartCount={0} />);
  expect(screen.getByTestId('pos-tab-cart-count').textContent).toBe('New');
  expect(screen.getByRole('tab', { name: 'Cart, New' })).not.toBeNull();
  view.rerender(<PosPhoneTabBar active="products" onSelect={() => {}} cartCount={3} />);
  expect(screen.getByTestId('pos-tab-cart-count').textContent).toBe('3');
  expect(screen.getByRole('tab', { name: 'Cart, 3' })).not.toBeNull();
});

test('the active tab is selected and the other is not, in a tablist', () => {
  const view = render(<PosPhoneTabBar active="products" onSelect={() => {}} cartCount={0} />);
  expect(screen.getByRole('tablist')).not.toBeNull();
  expect(screen.getByTestId('pos-tab-products').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('pos-tab-cart').getAttribute('aria-selected')).toBe('false');
  view.rerender(<PosPhoneTabBar active="cart" onSelect={() => {}} cartCount={0} />);
  expect(screen.getByTestId('pos-tab-products').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('pos-tab-cart').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Products')).not.toBeNull();
  expect(screen.getByText('Cart')).not.toBeNull();
});

test('pressing a tab calls onSelect with that tab', () => {
  const onSelect = vi.fn();
  render(<PosPhoneTabBar active="products" onSelect={onSelect} cartCount={2} />);
  fireEvent.click(screen.getByTestId('pos-tab-cart'));
  expect(onSelect).toHaveBeenLastCalledWith('cart');
  fireEvent.click(screen.getByTestId('pos-tab-products'));
  expect(onSelect).toHaveBeenLastCalledWith('products');
  expect(onSelect).toHaveBeenCalledTimes(2);
});
