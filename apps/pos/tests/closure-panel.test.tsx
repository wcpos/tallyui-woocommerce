import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { formatClosureDate, type Closure, type Correction } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { ClosurePanel } from '../components/closure-panel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function closure(over: Partial<Closure> & Pick<Closure, 'id' | 'number' | 'business_day' | 'opened_at' | 'closed_at' | 'expected' | 'counted' | 'variance'>): Closure {
  return {
    session_id: '', register_id: '', till_expected: {}, period_sales_total_minor: 0,
    period_refunds_total_minor: 0, perpetual_sales_total_minor: 0, perpetual_refunds_total_minor: 0,
    unsynced_count: 0, unsynced_total_minor: 0, software_version: 'test',
    breakdowns: { register_name: 'This till' }, order_ids: [], movement_ids: [], print_count: 0, ...over,
  };
}

const c4 = closure({
  id: 'c4', number: 4, business_day: '2026-11-10',
  opened_at: new Date(2026, 10, 10, 9, 0).toISOString(), closed_at: new Date(2026, 10, 10, 12, 30).toISOString(), closed_by: 'u1',
  expected: { cash: 12500, card: 2500 }, counted: { cash: 12400, card: 2500 }, variance: { cash: -100, card: 0 },
  period_sales_total_minor: 6500,
  breakdowns: {
    register_name: 'Front till', opened_by: 'u1', opened_by_name: 'Paul',
    transaction_count: 3, cashiers: [{ id: 'u1', name: 'Paul' }],
    opening_float: { expected_minor: 10000, counted_minor: 10000, variance_minor: 0 },
    payment_methods: { cash: { sales_minor: 4000, refunds_minor: 500 }, card: { sales_minor: 2500, refunds_minor: 0 } },
    movements: [
      { id: 'm1', type: 'paid_in', amountMinor: 1000, reason: 'Change' },
      { id: 'm2', type: 'paid_out', amountMinor: 2000, reason: 'Milk' },
      { id: 'm3', type: 'paid_out', amountMinor: 300, reason: 'Stamps', voided_by: 'm4' },
      { id: 'm4', type: 'void', amountMinor: 300, reason: 'Mistake', voids: 'm3' },
      { id: 'm5', type: 'no_sale', amountMinor: 0, reason: 'Change' },
    ],
  },
});
const props = {
  closure: c4, storeName: 'Main Street', currency: 'USD', locale: 'en-US', blind: false,
  resolveCashierName: (id: string) => id === 'u1' ? 'Paul' : id, onReprint: vi.fn(), onClose: vi.fn(),
};
const recount: Correction = {
  id: 7, type: 'recount', created_at: '2026-11-10T13:00:00Z', actor: { id: 'u2', name: 'Sam' },
  approver: { id: 'u1', name: 'Paul' }, reason: 'Found a note under the tray', figures: { counted: { cash: 12500 } },
};
const lateMovement: Correction = {
  id: 8, type: 'late_movement', created_at: '2026-11-10T13:30:00Z', actor: { id: 'u2', name: 'Sam' },
  approver: null, reason: 'Float top-up', figures: { cash_delta: -100 },
};

test('shows the heading, the result and the drawer ladder', () => {
  render(<><ClosurePanel {...props} /><PortalHost /></>);
  for (const [id, text] of Object.entries({
    'closure-panel-title': 'Closure 4',
    'closure-panel-description': 'Main Street · Front till · Tue 10 Nov 09:00–12:30 · Paul',
    'closure-result-word': 'Variance · Short', 'closure-figure-result': '−$1.00',
    'closure-figure-counted': '$124.00', 'closure-figure-expected': '$125.00',
    'closure-term-float': 'Float opened 09:00 by Paul', 'closure-term-float-amount': '$100.00',
    'closure-term-cash-sales-amount': '$40.00', 'closure-term-cash-refunds-amount': '−$5.00',
    'closure-term-paid-in': 'Paid in 1 · Change', 'closure-term-paid-in-amount': '$10.00',
    'closure-term-paid-out': 'Paid out 1 · Milk', 'closure-term-paid-out-amount': '−$20.00',
    'closure-term-no-sales-amount': '1', 'closure-term-expected-amount': '$125.00',
    'closure-term-counted': 'Counted', 'closure-term-counted-amount': '$124.00',
    'closure-tender-expected-card': 'Card', 'closure-tender-expected-card-amount': '$25.00',
    'closure-tender-counted-card': 'Card · Counted Exact', 'closure-tender-counted-card-amount': '$25.00',
    'closure-term-cashiers-amount': 'Paul', 'closure-term-sales-amount': '3 · $65.00',
  })) expect(screen.getByTestId(id).textContent).toBe(text);
  for (const id of ['closure-settled', 'closure-term-late-corrections', 'closure-recount']) expect(screen.queryByTestId(id)).toBeNull();
  expect(screen.queryAllByTestId(/^closure-correction-/)).toHaveLength(0);
});

test('a recount settles the counted cash and lists the correction', () => {
  render(<><ClosurePanel {...props} corrections={[recount]} /><PortalHost /></>);
  expect(screen.getByTestId('closure-result-word').textContent).toBe('Variance · Exact');
  expect(screen.getByTestId('closure-figure-result').textContent).toBe('$0.00');
  expect(screen.getByTestId('closure-figure-counted').textContent).toBe('$125.00');
  expect(screen.getByTestId('closure-term-counted').textContent).toBe('Counted settled');
  expect(screen.getByTestId('closure-term-counted-amount').textContent).toBe('$125.00');
  expect(screen.getByTestId('closure-settled').textContent).toBe('Recorded $124.00 · $1.00 short. Settled at $125.00 after 1 recount.');
  const correction = screen.getByTestId('closure-correction-7').textContent;
  expect(correction).toContain('Recount');
  expect(correction).toContain('Sam · Approved by Paul');
  expect(correction).toContain('Found a note under the tray');
  expect(correction).toContain(formatClosureDate('2026-11-10T13:00:00Z', { timezone: 'device', locale: 'en-US' }).datetime);
  expect(screen.queryByTestId('closure-term-late-corrections')).toBeNull();
});

test('a late movement adds a late corrections term and the late notice', () => {
  render(<><ClosurePanel {...props} corrections={[lateMovement]} /><PortalHost /></>);
  expect(screen.getByTestId('closure-term-late-corrections').textContent).toBe('Late corrections 1');
  expect(screen.getByTestId('closure-term-late-corrections-amount').textContent).toBe('−$1.00');
  expect(screen.getByTestId('closure-term-expected-amount').textContent).toBe('$124.00');
  expect(screen.getByTestId('closure-figure-expected').textContent).toBe('$124.00');
  expect(screen.getByTestId('closure-term-counted').textContent).toBe('Counted');
  expect(screen.getByTestId('closure-result-word').textContent).toBe('Variance · Exact');
  expect(screen.getByTestId('closure-settled').textContent).toBe('Recorded $124.00 · $1.00 short. Settled at $124.00 after a late sale, refund or movement.');
  const correction = screen.getByTestId('closure-correction-8').textContent;
  expect(correction).toContain('Late movement');
  expect(correction).toContain('Sam');
  expect(correction).toContain('Float top-up');
  expect(correction).not.toContain('Approved by');
});

test('a blind cashier sees the count but no expected figures or money terms', () => {
  render(<><ClosurePanel {...props} blind corrections={[recount]} /><PortalHost /></>);
  for (const id of ['closure-result-word', 'closure-figure-result', 'closure-figure-expected', 'closure-settled', 'closure-term-float-amount', 'closure-term-expected-amount']) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
  expect(screen.getByTestId('closure-figure-counted').textContent).toBe('$125.00');
  expect(screen.getByTestId('closure-term-sales-amount').textContent).toBe('3');
  expect(screen.getByTestId('closure-term-no-sales-amount').textContent).toBe('1');
  expect(screen.getByTestId('closure-tender-counted-card').textContent).toBe('Card · Counted');
});

test('Print closure and Close call back, and there is no Recount', () => {
  render(<><ClosurePanel {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('closure-reprint'));
  expect(props.onReprint).toHaveBeenCalledTimes(1);
  expect(props.onReprint).toHaveBeenCalledWith(c4);
  expect(screen.queryByTestId('closure-recount')).toBeNull();
  fireEvent.click(screen.getByTestId('closure-panel-close'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});
