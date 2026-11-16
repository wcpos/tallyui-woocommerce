import { expect, test } from 'vitest';
import type { Closure, RegisterSession } from '@tallyui/pos';
import { closuresScope, periodNow, salesPeriod } from '../lib/reports/report-scope';

const now = new Date(2026, 10, 16, 14, 30);

test('today compares one day with yesterday, fetching from the previous midnight', () => {
  const period = salesPeriod('today', 'yesterday', now, 'en-US');
  expect(period.range).toEqual({ from: '2026-11-16', to: '2026-11-16' });
  expect(period.multiDay).toBe(false);
  expect(period.comparison).toEqual({ from: '2026-11-15', to: '2026-11-15' });
  expect(period.comparisonName).toBe('yesterday');
  expect(period.since).toBe(new Date(2026, 10, 15).toISOString());
  expect(period.bounds).toEqual({ startIso: new Date(2026, 10, 16).toISOString(), endIso: new Date(2026, 10, 17).toISOString() });
});

test('lastweek compares the same weekday and names it in the supplied locale', () => {
  const period = salesPeriod('today', 'lastweek', now, 'en-US');
  expect(period.weekday).toBe('Monday');
  expect(period.comparisonName).toBe('last Monday');
  expect(period.comparison).toEqual({ from: '2026-11-09', to: '2026-11-09' });
});

test.each([['thisWeek', 'week before'], ['thisMonth', 'month before']] as const)(
  '%s is multi-day and names the period before', (preset, name) => {
    const period = salesPeriod(preset, 'lastweek', now, 'en-US');
    expect(period.multiDay).toBe(true);
    expect(period.comparisonName).toBe(name);
  });

test('a live day uses the current minute, and a past day has no future buckets', () => {
  const today = salesPeriod('today', 'yesterday', now, 'en-US');
  expect(periodNow(today.range, today.multiDay, now)).toEqual({ live: true, nowKey: 14 * 60 + 30 });
  const past = salesPeriod('yesterday', 'yesterday', now, 'en-US');
  expect(periodNow(past.range, past.multiDay, now)).toEqual({ live: false, nowKey: Infinity });
});

test('a live multi-day period uses today’s index', () => {
  const period = salesPeriod('thisMonth', 'yesterday', now, 'en-US');
  expect(periodNow(period.range, period.multiDay, now)).toEqual({ live: true, nowKey: 15 });
});

const active = { opened_by: '7' } as RegisterSession;
const scope = { range: { from: '2026-11-15', to: '2026-11-16' }, registerId: 'till', storeKey: 'store',
  cashier: null, today: '2026-11-16', active };

test('closures match the cashier against closed_by', () => {
  const rows = [
    { id: 'a', business_day: '2026-11-16', opened_at: now.toISOString(), closed_at: now.toISOString(),
      register_id: 'till', store_key: 'store', closed_by: '7' },
    { id: 'b', business_day: '2026-11-16', opened_at: now.toISOString(), closed_at: now.toISOString(),
      register_id: 'till', store_key: 'store', closed_by: '8' },
  ] as Closure[];
  expect(closuresScope(rows, { ...scope, cashier: '7' }).closures).toEqual([rows[0]]);
  expect(closuresScope(rows, scope).closures).toEqual(rows);
});

test.each([null, '7'])('the open session counts in today’s scope for cashier %s', cashier => {
  expect(closuresScope([], { ...scope, cashier }).openSession).toBe(active);
});

test.each([
  { from: '2026-11-14', to: '2026-11-15' },
  { from: '2026-11-17', to: '2026-11-18' },
])('the open session does not count outside today: %s', range => {
  expect(closuresScope([], { ...scope, range }).openSession).toBeNull();
});

test('the open session does not count for a different cashier or when absent', () => {
  expect(closuresScope([], { ...scope, cashier: '8' }).openSession).toBeNull();
  expect(closuresScope([], { ...scope, active: null }).openSession).toBeNull();
});
