import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StoreOrder } from '@tallyui/core';
import { OrderDetailView } from '../components/order-detail';
import { classesOf } from './classes-of';

afterEach(cleanup);

function make(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z', currency: 'USD',
    pricesIncludeTax: false, customer: null,
    lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
    fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
    payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
    discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600, ...overrides,
  };
}

const show = (order: StoreOrder) => render(<OrderDetailView order={order} onReceipt={vi.fn()} onClose={vi.fn()} />);
const part = (testID: string) => within(screen.getByTestId(testID));

test('the header shows v2\'s order title, its status and when it was placed', () => {
  show(make());
  expect(screen.getByTestId('order-modal-title').textContent).toBe('Order #901');
  expect(classesOf('order-modal-title')).toEqual(expect.arrayContaining(['text-lg', 'leading-none'])); // v2's dialog rank
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Completed');
  expect(screen.getByTestId('order-modal-identity').textContent).toBe(
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-10-15T10:00:00Z')));
});

test('an unknown status word is capitalised', () => {
  show(make({ status: 'pos-open' }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Pos-open');
});

test('a partly refunded order reads Partially refunded and closes on Net Payment', () => {
  show(make({ refunds: [{ id: 'r1', amountMinor: 200 }] }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Partially refunded');
  expect(part('order-modal-total-refund').getByText('Refund')).not.toBeNull();
  expect(part('order-modal-total-refund').getByText('-$2.00')).not.toBeNull();
  expect(part('order-modal-total-total').getByText('Net Payment')).not.toBeNull();
  expect(part('order-modal-total-total').getByText('$4.00')).not.toBeNull();
  cleanup();
  show(make({ status: 'refunded', refunds: [{ id: 'r1', amountMinor: 600 }] }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Refunded');
});

test('items show qty, unit price and line total, a struck original price when discounted, and fees after them', () => {
  show(make({
    lines: [
      { id: '1', name: 'Espresso', sku: 'ESP-1', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 },
      { id: '2', name: 'Latte', quantity: 1, subtotalMinor: 500, subtotalTaxMinor: 0, totalMinor: 400, taxMinor: 0 },
    ],
    fees: [{ name: 'Service', totalMinor: 100, taxMinor: 0 }],
  }));
  for (const head of ['Qty', 'Item', 'Price', 'Total']) expect(part('order-modal-items').getByText(head)).not.toBeNull();
  for (const text of ['2', 'Espresso', 'ESP-1', '$3.00', '$6.00']) expect(part('order-modal-line-0').getByText(text)).not.toBeNull();
  expect(screen.queryByTestId('order-modal-line-0-was')).toBeNull();
  expect(screen.getByTestId('order-modal-line-1-was').textContent).toBe('$5.00');
  expect(part('order-modal-line-1').getAllByText('$4.00')).toHaveLength(2);
  for (const text of ['Service', 'Fees', '$1.00']) expect(part('order-modal-fee-0').getByText(text)).not.toBeNull();
});

test('an order with no lines says so', () => {
  show(make({ lines: [] }));
  expect(part('order-modal-items').getByText('No line items.')).not.toBeNull();
  expect(part('order-modal-items').queryByText('Qty')).toBeNull();
});

test('totals show the discount with its coupon codes, shipping with its method, fees and tax by rate', () => {
  show(make({
    coupons: [{ code: 'SAVE10', discountMinor: 100, discountTaxMinor: 0 }], discountMinor: 100,
    shipping: [{ name: 'Flat rate', totalMinor: 500, taxMinor: 0 }], fees: [{ name: 'Service', totalMinor: 100, taxMinor: 0 }],
    taxLines: [{ label: 'VAT', ratePpm: 200000, amountMinor: 120 }], taxMinor: 120, totalMinor: 1220,
  }));
  const rows: [string, string[]][] = [
    ['subtotal', ['Subtotal', '$6.00']], ['discount', ['Discount', 'SAVE10', '-$1.00']],
    ['shipping', ['Shipping', '· Flat rate', '$5.00']], ['fees', ['Fees', '$1.00']], ['tax', ['Tax', '$1.20']],
    ['tax-0', ['VAT 20%', '$1.20']], ['total', ['Total', '$12.20']],
  ];
  for (const [row, texts] of rows) {
    for (const text of texts) expect(part(`order-modal-total-${row}`).getByText(text)).not.toBeNull();
  }
  expect(screen.queryByTestId('order-modal-total-refund')).toBeNull();
  cleanup();
  show(make());
  for (const row of ['discount', 'shipping', 'fees', 'tax']) expect(screen.queryByTestId(`order-modal-total-${row}`)).toBeNull();
});

test('a tax-inclusive order shows gross figures', () => {
  show(make({
    pricesIncludeTax: true,
    lines: [{ id: '1', name: 'Espresso', quantity: 1, subtotalMinor: 500, subtotalTaxMinor: 100, totalMinor: 500, taxMinor: 100 }],
    taxMinor: 100, totalMinor: 600,
  }));
  expect(part('order-modal-line-0').getAllByText('$6.00')).toHaveLength(2);
  expect(part('order-modal-total-subtotal').getByText('$6.00')).not.toBeNull();
});

test('payments are listed by the store\'s name, titled Payments when there are several', () => {
  show(make());
  expect(part('order-modal-payments').getByText('Payment')).not.toBeNull();
  expect(screen.getAllByTestId('order-modal-payment')).toHaveLength(1);
  expect(part('order-modal-payment').getByText('Cash')).not.toBeNull();
  expect(part('order-modal-payment').getByText('$6.00')).not.toBeNull();
  cleanup();
  show(make({ payments: [{ method: 'pos_cash', title: 'Cash', amountMinor: 400 }, { method: 'stripe', amountMinor: 200 }] }));
  expect(part('order-modal-payments').getByText('Payments')).not.toBeNull();
  const payments = screen.getAllByTestId('order-modal-payment');
  expect(payments).toHaveLength(2);
  expect(within(payments[1]).getByText('stripe')).not.toBeNull();
  expect(within(payments[1]).getByText('$2.00')).not.toBeNull();
  cleanup();
  show(make({ payments: [] }));
  expect(screen.queryByTestId('order-modal-payments')).toBeNull();
});

test('the customer is named with the email, and Guest when there is none', () => {
  show(make());
  expect(part('order-modal-customer').getByText('Guest')).not.toBeNull();
  cleanup();
  show(make({ customer: { id: '7', name: 'Ada Lovelace', email: 'ada@example.com' } }));
  expect(part('order-modal-customer').getByText('Ada Lovelace')).not.toBeNull();
  expect(part('order-modal-customer').getByText('ada@example.com')).not.toBeNull();
});

test('Receipt and Close call their handlers', () => {
  const onReceipt = vi.fn();
  const onClose = vi.fn();
  render(<OrderDetailView order={make()} onReceipt={onReceipt} onClose={onClose} />);
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(onReceipt).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('order-modal-close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
