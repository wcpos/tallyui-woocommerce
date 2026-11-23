import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { CheckoutTitleBar } from '../components/checkout-title-bar';
import { classesOf } from './classes-of';

afterEach(() => { cleanup(); });

test('the bar reads Checkout, then its slot, then an X labelled Close that calls onClose', () => {
  const onClose = vi.fn();
  render(<CheckoutTitleBar onClose={onClose} disabled={false}><Text testID="slot">Cancel payment</Text></CheckoutTitleBar>);
  const bar = screen.getByTestId('checkout-title-bar');
  expect(within(bar).getByTestId('checkout-title').textContent).toBe('Checkout');
  const close = within(bar).getByTestId('checkout-close');
  expect(close.getAttribute('aria-label')).toBe('Close');
  expect(screen.getByTestId('slot').compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the bar takes v2's title-row spacing (checkout-column.tsx:41)", () => {
  render(<CheckoutTitleBar onClose={() => {}} disabled={false} />);
  expect(classesOf('checkout-title-bar')).toEqual(expect.arrayContaining(['flex-row', 'items-center', 'gap-3', 'p-2']));
});

test('a disabled X is marked disabled and a press does nothing', () => {
  const onClose = vi.fn();
  render(<CheckoutTitleBar onClose={onClose} disabled />);
  const close = screen.getByTestId('checkout-close');
  expect(close.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(close);
  expect(onClose).not.toHaveBeenCalled();
});
