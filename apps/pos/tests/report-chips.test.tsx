import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { CompareChip, PrintSummaryButton, ReportChips, reportCashiers } from '../components/report-chips';
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

function show(chips: ReturnType<typeof props>) {
  render(<><ReportChips {...chips} /><CompareChip {...chips} /><PortalHost /></>);
}

test('Print summary is a labelled outline button when wide and an icon button with the same name when narrow', () => {
  const onPress = vi.fn();
  render(<PrintSummaryButton wide onPress={onPress} />);
  expect(screen.getByTestId('reports-print-summary').textContent).toBe('Print summary');
  fireEvent.click(screen.getByTestId('reports-print-summary'));
  expect(onPress).toHaveBeenCalledOnce();
  cleanup();
  render(<PrintSummaryButton wide={false} onPress={onPress} />);
  expect(screen.getByTestId('reports-print-summary').textContent).toBe('');
  expect(screen.getByRole('button', { name: 'Print summary' })).toBe(screen.getByTestId('reports-print-summary'));
});

async function menu(name: 'cashier' | 'compare') {
  fireEvent.click(screen.getByTestId(`hero-chip-${name}`));
  return within(await screen.findByTestId(`hero-${name}-menu`));
}

test('the chips show Everyone and yesterday, and their menus offer Everyone first', async () => {
  show(props());
  expect(screen.getByTestId('hero-chip-cashier').textContent).toBe('Everyone▾');
  expect(screen.getByTestId('hero-chip-compare').textContent).toBe('vs yesterday▾');
  expect(screen.queryByTestId('hero-chip-cashier-clear')).toBeNull();
  expect(screen.queryByTestId('hero-chip-compare-clear')).toBeNull();
  expect((await menu('cashier')).getAllByRole('menuitem').map(row => row.textContent)).toEqual(['Everyone✓', 'Paul', 'Ann']);
  fireEvent.click(screen.getByTestId('hero-cashier-all'));
  const compare = await menu('compare');
  expect(compare.getAllByRole('menuitem').map(row => row.textContent)).toEqual(['vs yesterday✓', 'vs last Tuesday']);
});

test('the compare menu carries the same-time hint, and there is no standalone hint line', async () => {
  show(props());
  expect(screen.queryByTestId('hero-compare-hint')).toBeNull();
  expect((await menu('compare')).getByTestId('hero-compare-menu-hint').textContent).toBe('A live day is compared at the same time of day');
});

test('a chosen cashier and comparison show on their chips and are marked in the menus', async () => {
  show(props({ cashierId: '5', compare: 'lastweek' }));
  expect(screen.getByTestId('hero-chip-cashier').textContent).toBe('Ann▾');
  expect(screen.getByTestId('hero-chip-compare').textContent).toBe('vs last Tuesday▾');
  await menu('cashier');
  expect(screen.getByTestId('hero-cashier-5').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('hero-cashier-all').getAttribute('aria-selected')).toBe('false');
});

test('choosing a menu row reports the choice; Everyone reports null', async () => {
  const chips = props();
  show(chips);
  fireEvent.click((await menu('cashier')).getByTestId('hero-cashier-5'));
  expect(chips.onCashier).toHaveBeenLastCalledWith('5');
  fireEvent.click((await menu('compare')).getByTestId('hero-compare-lastweek'));
  expect(chips.onCompare).toHaveBeenLastCalledWith('lastweek');
  cleanup();
  const chosen = props({ cashierId: '5' });
  show(chosen);
  fireEvent.click((await menu('cashier')).getByTestId('hero-cashier-all'));
  expect(chosen.onCashier).toHaveBeenLastCalledWith(null);
});

test('the clear on a chosen cashier puts Everyone back, and on a comparison puts yesterday back', () => {
  const chips = props({ cashierId: '5', compare: 'lastweek' });
  show(chips);
  fireEvent.click(screen.getByTestId('hero-chip-cashier-clear'));
  expect(chips.onCashier).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByTestId('hero-chip-compare-clear'));
  expect(chips.onCompare).toHaveBeenLastCalledWith('yesterday');
});

test('reportCashiers lists each cashier once, in order', () => {
  expect(reportCashiers([{ id: 2, displayName: 'Paul' }, { id: 5, displayName: 'Ann' }, { id: 2, displayName: 'Paul again' }]))
    .toEqual([{ id: '2', name: 'Paul' }, { id: '5', name: 'Ann' }]);
  expect(reportCashiers([])).toEqual([]);
});
