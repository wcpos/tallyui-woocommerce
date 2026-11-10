import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReportChips, reportCashiers } from '../components/report-chips';
import type { Compare } from '../lib/reports/sales-room';

afterEach(cleanup);

function props(overrides: { cashierId?: string | null; compare?: Compare } = {}) {
  return {
    cashiers: [{ id: '2', name: 'Paul' }, { id: '5', name: 'Ann' }],
    cashierId: null,
    onCashier: vi.fn(),
    compare: 'yesterday' as Compare,
    onCompare: vi.fn(),
    weekday: 'Tuesday',
    ...overrides,
  };
}

test('the chips offer Everyone first and mark the current choices', () => {
  render(<ReportChips {...props()} />);
  expect(within(screen.getByTestId('hero-cashier')).getAllByRole('tab').map(tab => tab.textContent))
    .toEqual(['Everyone', 'Paul', 'Ann']);
  expect(within(screen.getByTestId('hero-compare')).getAllByRole('tab').map(tab => tab.textContent))
    .toEqual(['vs yesterday', 'vs last Tuesday']);
  expect(screen.getByTestId('hero-cashier-all').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-compare-yesterday').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-cashier-2').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('hero-compare-lastweek').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('hero-compare-hint').textContent).toBe('A live day is compared at the same time of day');
});

test('a chosen cashier and comparison are marked', () => {
  render(<ReportChips {...props({ cashierId: '5', compare: 'lastweek' })} />);
  expect(screen.getByTestId('hero-cashier-5').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-compare-lastweek').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-cashier-all').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('hero-compare-yesterday').getAttribute('aria-selected')).toBe('false');
});

test('pressing a chip reports the choice', () => {
  const chips = props();
  render(<ReportChips {...chips} />);
  fireEvent.click(screen.getByTestId('hero-cashier-5'));
  expect(chips.onCashier).toHaveBeenLastCalledWith('5');
  fireEvent.click(screen.getByTestId('hero-cashier-all'));
  expect(chips.onCashier).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByTestId('hero-compare-lastweek'));
  expect(chips.onCompare).toHaveBeenLastCalledWith('lastweek');
});

test('reportCashiers lists each cashier once, in order', () => {
  expect(reportCashiers([{ id: 2, displayName: 'Paul' }, { id: 5, displayName: 'Ann' }, { id: 2, displayName: 'Paul again' }]))
    .toEqual([{ id: '2', name: 'Paul' }, { id: '5', name: 'Ann' }]);
  expect(reportCashiers([])).toEqual([]);
});
