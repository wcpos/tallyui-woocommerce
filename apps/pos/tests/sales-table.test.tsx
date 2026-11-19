import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { SalesTable } from '../components/sales-table';

const table = {
  title: 'Orders',
  head: ['Order', 'Time', 'Paid by', 'Total'],
  align: ['left', 'left', 'left', 'right'] as ('left' | 'right')[],
  rows: [{ key: 'a', cells: ['62bcae34 · #228', '13:05', 'Card terminal', '$3.33'] }],
  total: ['Total', '', '', '$3.33'],
  status: '1 order · $3.33',
  empty: 'No orders in this period',
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('phone rows stack labels and values without table headings', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
  render(<><SalesTable table={table} scope="Today · This till" onClose={vi.fn()} /><PortalHost /></>);
  expect(within(screen.getByTestId('sales-table-row-a')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    '62bcae34 · #228', 'Time', '13:05', 'Paid by', 'Card terminal', 'Total', '$3.33',
  ]);
  expect(within(screen.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', 'Total', '$3.33',
  ]);
  expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
});

// v2 orders-panel.tsx: each row's tick box, "Include order {number}"; the Counted column is not painted on screen.
test('with ticks a phone row starts with its tick box, paints no Counted line, and unticking asks to leave it out', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
  const onInclude = vi.fn();
  const counted = { ...table, head: [...table.head, 'Counted'], rows: [{ key: 'a', cells: ['#228', '13:05', 'Card terminal', '$3.33', 'Yes'] }],
    total: ['Counted', '', '', '$3.33', ''] };
  render(<><SalesTable table={counted} scope="Today · This till" ticks={{ leftOut: new Set(), onInclude }} onClose={vi.fn()} /><PortalHost /></>);
  const row = screen.getByTestId('sales-table-row-a');
  const tick = within(row).getByTestId('orders-panel-tick-a');
  expect(tick.getAttribute('aria-label')).toBe('Include order 228');
  expect(within(row).queryByText('Counted')).toBeNull();
  fireEvent.click(tick);
  expect(onInclude).toHaveBeenCalledWith(['a'], false);
});

test('wide rows retain columns', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
  render(<><SalesTable table={table} scope="Today · This till" onClose={vi.fn()} /><PortalHost /></>);
  const row = screen.getByTestId('sales-table-row-a');
  expect(within(row).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    '62bcae34 · #228', '13:05', 'Card terminal', '$3.33',
  ]);
  expect(screen.getAllByRole('columnheader')).toHaveLength(4);
});

test('phone empty state keeps only populated total values', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
  render(<><SalesTable table={{ ...table, rows: [], total: ['Total', '', '', '$0.00'] }} scope="Today · This till" onClose={vi.fn()} /><PortalHost /></>);
  expect(screen.getByText('No orders in this period')).not.toBeNull();
  expect(within(screen.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', 'Total', '$0.00',
  ]);
});

test('Print report shows only with onPrint and calls it', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
  const view = render(<><SalesTable table={table} scope="Today · This till" onClose={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('detail-panel-print')).toBeNull();
  view.unmount();
  const onPrint = vi.fn();
  render(<><SalesTable table={table} scope="Today · This till" onClose={vi.fn()} onPrint={onPrint} /><PortalHost /></>);
  const button = screen.getByTestId('detail-panel-print');
  expect(button.textContent).toBe('Print report');
  fireEvent.click(button);
  expect(onPrint).toHaveBeenCalledTimes(1);
});
