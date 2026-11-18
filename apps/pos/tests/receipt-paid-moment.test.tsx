import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { PosOrder, PosOrderPayment } from '@tallyui/pos';
import { paidMomentFigures, ReceiptPaidMoment } from '../components/receipt-paid-moment';
import { memoryStorage } from './memory-storage';
import { classesOf } from './classes-of';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

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
  // v2 tone.ts:23: a warning word takes text-warning-text, the darker ink on light themes.
  expect(classesOf('receipt-awaiting-store')).toContain('text-warning-text');
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

// v2's AmountFigure hero (amount-figure/index.tsx:18-24): text-amt (40px, line 1.1), font-bold tabular-nums, centred.
const HERO = ['text-[40px]', 'leading-[44px]', 'font-bold', 'tabular-nums', 'text-center'];

/** The classes on the headline's first Text, read off its fibers up to the headline wrapper (it has no testID, as in v2). */
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber };
function headlineClasses(): string[] {
  const node = screen.getByTestId('checkout-paid-headline').firstElementChild as unknown as Record<string, unknown>;
  let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))!] as Fiber | undefined;
  const found: string[] = [];
  for (; fiber && fiber.memoizedProps?.testID !== 'checkout-paid-headline'; fiber = fiber.return) {
    const { className } = fiber.memoizedProps ?? {};
    if (typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

test("the change headline is v2's hero figure: 40px, bold, tabular, centred", () => {
  show([cash(600, { tenderedMinor: 1000, changeMinor: 400 })]);
  const classes = classesOf('receipt-change-due');
  expect(classes).toEqual(expect.arrayContaining(HERO));
  expect(classes).not.toContain('text-2xl');
  expect(classes).not.toContain('font-semibold');
});

test("the paid headline is v2's hero figure: 40px, bold, tabular, centred", () => {
  show([cash(600, { tenderedMinor: 600, changeMinor: 0 })]);
  const classes = headlineClasses();
  expect(classes).toEqual(expect.arrayContaining(HERO));
  expect(classes).not.toContain('text-2xl');
  expect(classes).not.toContain('font-semibold');
});
