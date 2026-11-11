import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CustomerServiceError } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import type { useSale } from '@tallyui/pos';
import { CouponRows } from '../components/coupon-entry';
import { PortalHost } from '@tallyui/primitives';
import { AddCustomerDialog } from '../components/add-customer-dialog';
import { Toaster } from '../components/toaster';
import type { CustomerSource } from '../lib/customers/customer-source';
import { dismissToast } from '../lib/toast/toast';

const removeCoupon = vi.fn<(code: string) => string | null>();
const sale = {
  order: { currency: 'USD', display: { coupons: [{ code: 'save10', amountMinor: 30 }] } }, removeCoupon,
} as unknown as ReturnType<typeof useSale>;
const gee: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const search = vi.fn<CustomerSource['search']>();
const create = vi.fn<CustomerSource['create']>();
const source = { search, create };
const onChange = vi.fn();

beforeEach(() => {
  removeCoupon.mockReset();
  search.mockReset().mockResolvedValue([gee]);
  create.mockReset().mockResolvedValue(gee);
  onChange.mockReset();
});
afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
});

test('removing a coupon toasts Coupon removed', () => {
  removeCoupon.mockReturnValue(null);
  render(<><CouponRows sale={sale} /><Toaster /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Remove coupon save10' }));
  expect(removeCoupon).toHaveBeenCalledWith('save10');
  expect(within(screen.getByTestId('info-toast')).getByText('Coupon removed')).not.toBeNull();
});

test('a refused coupon removal toasts the refusal as a warning, not an inline alert', () => {
  removeCoupon.mockReturnValue('Void the payments first');
  render(<><CouponRows sale={sale} /><Toaster /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Remove coupon save10' }));
  expect(within(screen.getByTestId('warning-toast')).getByText('Void the payments first')).not.toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

// The cart's Add new customer (cart-add-menu.tsx) is AddCustomerDialog with onCreated.
function createCustomer() {
  render(<><AddCustomerDialog source={source} onClose={() => {}} onCreated={onChange} /><PortalHost /><Toaster /></>);
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: 'gee@example.invalid' } });
  fireEvent.click(within(screen.getByTestId('customer-form')).getByText('Add Customer'));
}

test('creating a customer toasts the saved name', async () => {
  createCustomer();
  expect(within(await screen.findByTestId('success-toast')).getByText('Gee Four saved')).not.toBeNull();
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ id: '7', name: 'Gee Four', email: 'gee@example.invalid' });
});

test('a failed create shows no success toast', async () => {
  create.mockRejectedValue(new CustomerServiceError('network', 'Offline'));
  createCustomer();
  expect(within(await screen.findByTestId('error-toast')).getByText("Could not reach the store's customers: Offline")).not.toBeNull();
  expect(screen.queryByTestId('success-toast')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});
