import { cleanup, render, screen, within } from '@testing-library/react';
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
  expect(screen.getByText('No sales yet today.')).not.toBeNull();
  expect(within(screen.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', 'Total', '$0.00',
  ]);
});
