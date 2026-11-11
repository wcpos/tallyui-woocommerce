import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Closure } from '@tallyui/pos';
import { ClosureStats } from '../components/closure-stats';

afterEach(cleanup);

function closure(over: Partial<Closure> & Pick<Closure, 'id' | 'number' | 'business_day' | 'opened_at' | 'closed_at' | 'expected' | 'counted' | 'variance'>): Closure {
  return {
    session_id: '', register_id: '', till_expected: {}, period_sales_total_minor: 0,
    period_refunds_total_minor: 0, perpetual_sales_total_minor: 0, perpetual_refunds_total_minor: 0,
    unsynced_count: 0, unsynced_total_minor: 0, software_version: 'test',
    breakdowns: { register_name: 'This till' }, order_ids: [], movement_ids: [], print_count: 0, ...over,
  };
}

// Floats as writeClosure freezes them: c2 counted 100.00 in; c1 has only the expected float on record.
const c2 = closure({
  id: 'c2', number: 2, business_day: '2026-11-10',
  opened_at: new Date(2026, 10, 10, 9, 0).toISOString(), closed_at: new Date(2026, 10, 10, 12, 30).toISOString(),
  expected: { cash: 12000 }, counted: { cash: 11900 }, variance: { cash: -100 },
  breakdowns: { register_name: 'This till', opening_float: { expected_minor: 10000, counted_minor: 10000, variance_minor: 0 } },
});
const c1 = closure({
  id: 'c1', number: 1, business_day: '2026-11-09',
  opened_at: new Date(2026, 10, 9, 9, 0).toISOString(), closed_at: new Date(2026, 10, 9, 17, 30).toISOString(),
  expected: { cash: 10300 }, counted: { cash: 10300 }, variance: { cash: 0 },
  breakdowns: { register_name: 'This till', opening_float: { expected_minor: 5000, counted_minor: null, variance_minor: null } },
});
const props = { currency: 'USD', locale: 'en-US', blind: false };
const note = (id: string) => screen.getByTestId(`closure-stat-${id}`).nextSibling?.textContent;

test('two closures and an open session add up in minor units', () => {
  render(<ClosureStats {...props} rows={[c2, c1]} openSession={{ counted_float_minor: 2500 }} />);
  expect(screen.getByTestId('closure-stat-discrepancy').textContent).toBe('−$1.00');
  expect(note('discrepancy')).toBe('1 short · 1 exact');
  expect(screen.getByTestId('closure-stat-sessions').textContent).toBe('3');
  expect(note('sessions')).toBe('1 open · 2 closed');
  // 100.00 + 50.00 + the open session's 25.00.
  expect(screen.getByTestId('closure-stat-cash-at-open').textContent).toBe('$175.00');
  expect(note('cash-at-open')).toBe('floats');
  // (120.00 + 103.00) expected less 150.00 of closure floats.
  expect(screen.getByTestId('closure-stat-cash-activity').textContent).toBe('+$73.00');
  expect(note('cash-activity')).toBe('sales − refunds ± movements');
  expect(screen.getByTestId('closure-stat-cash-at-close').textContent).toBe('$222.00');
  expect(note('cash-at-close')).toBe('2 counts');
});

test('a closure whose counted float differs from the expected one uses the counted float', () => {
  const recounted = closure({
    ...c2, id: 'c3',
    breakdowns: { register_name: 'This till', opening_float: { expected_minor: 10000, counted_minor: 9500, variance_minor: -500 } },
  });
  render(<ClosureStats {...props} rows={[recounted]} openSession={null} />);
  expect(screen.getByTestId('closure-stat-cash-at-open').textContent).toBe('$95.00');
  // 120.00 expected less the 95.00 counted in.
  expect(screen.getByTestId('closure-stat-cash-activity').textContent).toBe('+$25.00');
});

test('cash activity below the floats reads negative', () => {
  const drained = { ...c2, expected: { cash: 9000 } };
  render(<ClosureStats {...props} rows={[drained]} openSession={null} />);
  expect(screen.getByTestId('closure-stat-cash-activity').textContent).toBe('−$10.00');
});

test('nothing closed and no session', () => {
  render(<ClosureStats {...props} rows={[]} openSession={null} />);
  expect(screen.getByTestId('closure-stat-discrepancy').textContent).toBe('—');
  expect(screen.getByTestId('closure-stat-sessions').textContent).toBe('0');
  expect(note('sessions')).toBe('0 open · 0 closed');
  expect(screen.getByTestId('closure-stat-cash-at-open').textContent).toBe('$0.00');
  expect(screen.getByTestId('closure-stat-cash-activity').textContent).toBe('+$0.00');
  expect(screen.getByTestId('closure-stat-cash-at-close').textContent).toBe('—');
  expect(note('cash-at-close')).toBe('nothing closed yet');
});

test('a blind view renders no tiles', () => {
  const { container } = render(<ClosureStats {...props} blind rows={[c2, c1]} openSession={{ counted_float_minor: 2500 }} />);
  expect(container.innerHTML).toBe('');
  expect(screen.queryByTestId('closure-stats')).toBeNull();
});
