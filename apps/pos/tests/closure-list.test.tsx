import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { Closure } from '@tallyui/pos';
import { ClosureList, resultText, resultWord, signedMoney } from '../components/closure-list';

afterEach(cleanup);

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
  opened_at: new Date(2026, 10, 10, 9, 0).toISOString(), closed_at: new Date(2026, 10, 10, 12, 30).toISOString(),
  expected: { cash: 12000 }, counted: { cash: 11900 }, variance: { cash: -100 }, closed_by: 'u1',
});
const c3 = closure({
  id: 'c3', number: 3, business_day: '2026-11-10',
  opened_at: new Date(2026, 10, 10, 8, 0).toISOString(), closed_at: new Date(2026, 10, 10, 8, 45).toISOString(),
  expected: { cash: 10500 }, counted: { cash: 10550 }, variance: { cash: 50 }, closed_by: null,
});
const c2 = closure({
  id: 'c2', number: 2, business_day: '2026-11-09',
  opened_at: new Date(2026, 10, 9, 9, 0).toISOString(), closed_at: new Date(2026, 10, 9, 17, 30).toISOString(),
  expected: { cash: 10000 }, counted: { cash: 10000 }, variance: { cash: 0 }, closed_by: 'u1', corrections_count: 1,
});
const c1 = closure({
  id: 'c1', number: 1, business_day: '2026-11-08',
  opened_at: new Date(2026, 10, 8, 10, 0).toISOString(), closed_at: new Date(2026, 10, 8, 16, 0).toISOString(),
  expected: { cash: 10300 }, counted: { cash: 10000 }, variance: { cash: -300 }, closed_by: 'u1',
});
const rows = [c4, c3, c2, c1];
const props = {
  today: '2026-11-10', currency: 'USD', locale: 'en-US', blind: false, openSessions: 0,
  resolveCashierName: (id: string) => id === 'u1' ? 'Paul' : id, onReprint: () => {},
};

test('result words and signed differences', () => {
  const money = (n: number) => formatMoney({ amount: n, currency: 'USD' }, 'en-US') ?? '';
  expect(resultWord(-1)).toBe('Short');
  expect(resultWord(1)).toBe('Over');
  expect(resultWord(0)).toBe('Exact');
  expect(signedMoney(-100, money)).toBe('−$1.00');
  expect(signedMoney(50, money)).toBe('+$0.50');
  expect(signedMoney(0, money)).toBe('$0.00');
  expect(resultText(-50, money)).toBe('$0.50 short');
  expect(resultText(300, money)).toBe('$3.00 over');
  expect(resultText(0, money)).toBe('Exact');
});

test('groups closures by business day, newest first', () => {
  render(<ClosureList {...props} rows={rows} />);
  expect(screen.getAllByTestId(/^closure-day-\d/).map(group => group.getAttribute('data-testid'))).toEqual([
    'closure-day-2026-11-10', 'closure-day-2026-11-09', 'closure-day-2026-11-08',
  ]);
  expect(screen.getByTestId('closure-day-label-2026-11-10').textContent).toBe('Today');
  expect(screen.getByTestId('closure-day-label-2026-11-09').textContent).toBe('Yesterday');
  expect(screen.getByTestId('closure-day-label-2026-11-08').textContent).toBe('Sun 8 Nov');
  expect(screen.getByTestId('closure-day-summary-2026-11-10').textContent).toBe('$224.50 counted · $0.50 short');
  expect(screen.getByTestId('closure-day-summary-2026-11-09').textContent).toBe('$100.00 counted · Exact');
  expect(screen.getByTestId('closure-day-summary-2026-11-08').textContent).toBe('$100.00 counted · $3.00 short');
  expect(screen.getAllByTestId(/^closure-row-/).map(row => row.getAttribute('data-testid'))).toEqual([
    'closure-row-c4', 'closure-row-c3', 'closure-row-c2', 'closure-row-c1',
  ]);
});

test('a row shows expected, counted, difference and result', () => {
  render(<ClosureList {...props} rows={rows} />);
  expect(within(screen.getByTestId('closures-head')).getAllByText(/./).map(text => text.textContent)).toEqual([
    'Closure', 'Expected', 'Counted', 'Difference', 'Result',
  ]);
  expect(screen.getByTestId('closure-title-c4').textContent).toBe('Closure 4 · This till');
  expect(screen.getByTestId('closure-subline-c4').textContent).toBe('09:00 → 12:30 · Paul');
  expect(screen.getByTestId('closure-expected-c4').textContent).toBe('$120.00');
  expect(screen.getByTestId('closure-counted-c4').textContent).toBe('$119.00');
  expect(screen.getByTestId('closure-difference-c4').textContent).toBe('−$1.00');
  expect(screen.getByTestId('closure-result-c4').textContent).toBe('Short');
  expect(screen.getByTestId('closure-subline-c3').textContent).toBe('08:00 → 08:45 · Cashier');
  expect(screen.getByTestId('closure-difference-c3').textContent).toBe('+$0.50');
  expect(screen.getByTestId('closure-result-c3').textContent).toBe('Over');
  expect(screen.getByTestId('closure-difference-c2').textContent).toBe('$0.00');
  expect(screen.getByTestId('closure-result-c2').textContent).toBe('Exact');
});

test('a corrected closure carries the Corrected badge', () => {
  render(<ClosureList {...props} rows={rows} />);
  expect(screen.getByTestId('closure-badge-c2').textContent).toBe('Corrected');
  expect(screen.queryByTestId('closure-badge-c4')).toBeNull();
});

test('the count includes the open session', () => {
  const { rerender } = render(<ClosureList {...props} rows={rows} openSessions={1} />);
  expect(screen.getByTestId('closures-count').textContent).toBe('5 sessions');
  rerender(<ClosureList {...props} rows={[c2]} openSessions={0} />);
  expect(screen.getByTestId('closures-count').textContent).toBe('1 session');
});

test('a blind view hides expected figures', () => {
  render(<ClosureList {...props} rows={rows} blind />);
  expect(within(screen.getByTestId('closures-head')).getAllByText(/./).map(text => text.textContent)).toEqual(['Closure', 'Counted']);
  expect(screen.queryByTestId('closure-expected-c4')).toBeNull();
  expect(screen.queryByTestId('closure-difference-c4')).toBeNull();
  expect(screen.queryByTestId('closure-result-c4')).toBeNull();
  expect(screen.getByTestId('closure-counted-c4').textContent).toBe('$119.00');
  expect(screen.getByTestId('closure-day-summary-2026-11-10').textContent).toBe('$224.50 counted');
});

test('All, Open and Closed filter the list', () => {
  render(<ClosureList {...props} rows={rows} openSessions={1} sessionRows={<Text testID="fake-session">Open session</Text>} />);
  expect(within(screen.getByTestId('closures-filter')).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['All', 'Open', 'Closed']);
  expect(screen.getByTestId('fake-session')).not.toBeNull();
  expect(screen.getByTestId('closure-row-c1')).not.toBeNull();
  expect(screen.getByTestId('fake-session').compareDocumentPosition(screen.getByTestId('closure-row-c4')) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  fireEvent.click(screen.getByTestId('closures-filter-open'));
  expect(screen.getByTestId('fake-session')).not.toBeNull();
  expect(screen.queryAllByTestId(/^closure-row-/)).toHaveLength(0);
  expect(screen.queryByTestId('closure-day-2026-11-09')).toBeNull();
  fireEvent.click(screen.getByTestId('closures-filter-closed'));
  expect(screen.queryByTestId('fake-session')).toBeNull();
  expect(screen.getByTestId('closure-row-c4')).not.toBeNull();
  fireEvent.click(screen.getByTestId('closures-filter-all'));
  expect(screen.getByTestId('fake-session')).not.toBeNull();
  expect(screen.getByTestId('closure-row-c4')).not.toBeNull();
});

test('an open session with no closure today says so', () => {
  const sessionRows = <Text testID="fake-session">Open session</Text>;
  const { rerender } = render(<ClosureList {...props} rows={[c2, c1]} openSessions={1} sessionRows={sessionRows} />);
  expect(screen.getByTestId('closure-day-label-2026-11-10').textContent).toBe('Today');
  expect(screen.getByTestId('closures-none-today').textContent).toBe('No closures yet today');
  expect(screen.queryByTestId('closure-day-summary-2026-11-10')).toBeNull();
  rerender(<ClosureList {...props} rows={rows} openSessions={1} sessionRows={sessionRows} />);
  expect(screen.queryByTestId('closures-none-today')).toBeNull();
});

test('no closures and no session shows the empty line', () => {
  render(<ClosureList {...props} rows={[]} />);
  expect(screen.getByTestId('closures-empty').textContent).toBe('No closures in this period');
  expect(screen.getByTestId('closures-count').textContent).toBe('0 sessions');
  expect(screen.queryAllByTestId(/^closure-day-/)).toHaveLength(0);
});

test('Reprint hands the closure back', () => {
  const onReprint = vi.fn();
  render(<ClosureList {...props} rows={rows} onReprint={onReprint} />);
  fireEvent.click(screen.getByTestId('closure-reprint-c3'));
  expect(onReprint).toHaveBeenCalledOnce();
  expect(onReprint).toHaveBeenCalledWith(c3);
});
