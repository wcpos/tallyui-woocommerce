import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { PosOrder, PosOrderPayment } from '@tallyui/pos';
import { paidMomentFigures, ReceiptPaidMoment } from '../components/receipt-paid-moment';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const cash = (amountMinor: number, more: Partial<PosOrderPayment> = {}): PosOrderPayment => ({ id: crypto.randomUUID(), method: 'cash', amountMinor, ...more });
const external = (amountMinor: number): PosOrderPayment => ({ id: crypto.randomUUID(), method: 'external', amountMinor });

function show(payments: PosOrderPayment[], syncStatus: PosOrder['syncStatus'] = 'applied', onClose = vi.fn()) {
  return render(<ReceiptPaidMoment posOrder={{ currency: 'USD', syncStatus, payments }} onClose={onClose} />);
}

const paidWith = () => screen.getByTestId('receipt-paid-with').textContent;
const tone = () => screen.getByTestId('receipt-paid-disc').getAttribute('data-tone');

test('paidMomentFigures sums paid, change and cash tendered and lists each method once', () => {
  expect(paidMomentFigures([cash(200, { tenderedMinor: 500, changeMinor: 300 }), external(400), cash(100)]))
    .toEqual({ paidMinor: 700, changeMinor: 300, cashTenderedMinor: 600, methods: ['Cash', 'Card terminal'], paymentCount: 3 });
});

test('cash with change shows Change and what was tendered', () => {
  show([cash(600, { tenderedMinor: 1000, changeMinor: 400 })]);
  expect(screen.getByTestId('receipt-change-due').textContent).toBe('Change $4.00');
  expect(paidWith()).toBe('Paid $6.00 · tendered $10.00 in cash');
});

test('exact cash shows Paid and the method', () => {
  show([cash(600, { tenderedMinor: 600, changeMinor: 0 })]);
  expect(screen.getByTestId('checkout-paid-headline').textContent).toContain('Paid $6.00');
  expect(screen.queryByTestId('receipt-change-due')).toBeNull();
  expect(paidWith()).toBe('Cash');
});

test('a split shows each method and the payment count', () => {
  show([cash(200), external(400)]);
  expect(screen.getByTestId('checkout-paid-headline').textContent).toContain('Paid $6.00');
  expect(paidWith()).toBe('Cash + Card terminal · 2 payments');
});

test('a split with cash change sums the cash tendered and counts the payments', () => {
  show([cash(200, { tenderedMinor: 500, changeMinor: 300 }), external(400)]);
  expect(screen.getByTestId('receipt-change-due').textContent).toBe('Change $3.00');
  expect(paidWith()).toBe('Paid $6.00 · tendered $5.00 in cash · 2 payments');
});

test('while the store has not heard the sale the disc and sub-line say Awaiting store', () => {
  const payments = [cash(600)];
  const { rerender } = show(payments, 'pending');
  expect(screen.getByTestId('receipt-awaiting-store')).not.toBeNull();
  expect(paidWith()).toBe('Awaiting store · Cash');
  expect(tone()).toBe('warning');
  expect(screen.getByTestId('receipt-paid-disc').getAttribute('aria-label')).toBe('Awaiting store');
  rerender(<ReceiptPaidMoment posOrder={{ currency: 'USD', syncStatus: 'applied', payments }} onClose={() => {}} />);
  expect(screen.queryByTestId('receipt-awaiting-store')).toBeNull();
  expect(tone()).toBe('ok');
});

test('a refused sale shows no awaiting mark', () => {
  show([cash(600)], 'rejected');
  expect(screen.queryByTestId('receipt-awaiting-store')).toBeNull();
  expect(tone()).toBe('ok');
});

test('Close calls onClose once', () => {
  const onClose = vi.fn();
  show([cash(600)], 'applied', onClose);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
