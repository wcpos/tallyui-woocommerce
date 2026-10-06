import { expect, test } from 'vitest';
import { csvCell, salesTableCsv } from '../lib/reports/sales-table-csv';
import type { SalesTable } from '../lib/reports/sales-tables';

test('csvCell quotes and doubles quotes', () => {
  expect(csvCell('Cash')).toBe('"Cash"');
  expect(csvCell('a"b')).toBe('"a""b"');
  expect(csvCell('')).toBe('""');
  expect(csvCell(undefined)).toBe('""');
  expect(csvCell(null)).toBe('""');
  expect(csvCell('$3.00')).toBe('"$3.00"');
  expect(csvCell('T3 · #115')).toBe('"T3 · #115"');
});

test('csvCell neutralises formula and control prefixes', () => {
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
  expect(csvCell('+1')).toBe('"\'+1"');
  expect(csvCell('-5')).toBe('"\'-5"');
  expect(csvCell('@x')).toBe('"\'@x"');
  expect(csvCell(' =x')).toBe('"\' =x"');
  expect(csvCell('\tx')).toBe('"\'\tx"');
  expect(csvCell('\nx')).toBe('"\'\nx"');
  expect(csvCell('a=b')).toBe('"a=b"');
});

const table: SalesTable = {
  title: 'Payments',
  head: ['Method', 'Orders', 'Amount', 'Share'],
  align: ['left', 'right', 'right', 'right'],
  rows: [
    { key: 'external', cells: ['Card terminal', '2', '$7.00', '77.8%'] },
    { key: 'cash', cells: ['Cash', '1', '$2.00', '22.2%'] },
  ],
  total: ['Total', '2', '$9.00', ''],
  status: '2 orders',
};

test('salesTableCsv writes head, rows and total with CRLF', () => {
  expect(salesTableCsv(table)).toBe('"Method","Orders","Amount","Share"\r\n"Card terminal","2","$7.00","77.8%"\r\n"Cash","1","$2.00","22.2%"\r\n"Total","2","$9.00",""');
});

test('salesTableCsv of an empty table is head and total', () => {
  expect(salesTableCsv({ ...table, rows: [] })).toBe('"Method","Orders","Amount","Share"\r\n"Total","2","$9.00",""');
});
