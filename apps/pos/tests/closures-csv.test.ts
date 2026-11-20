import { expect, test } from 'vitest';
import { selectClosureRows, type Closure } from '@tallyui/pos';
import { closuresCsv } from '../lib/reports/closures-csv';

test('exports selected closures with English headers and saved cashier display names', () => {
  const user = { id: 2, uuid: 'cashier', displayName: 'Paul' };
  const closures: Closure[] = [1, 2].map(number => ({
    id: `session-${number}`, session_id: `session-${number}`, register_id: 'register', store_key: 'store',
    number, opened_at: `2026-10-0${number}T09:00:00Z`, closed_at: `2026-10-0${number}T17:00:00Z`,
    closed_by: String(user.id), till_expected: { cash: 10000 }, expected: { cash: 10300 },
    counted: { cash: 10300 }, variance: { cash: 0 }, period_sales_total_minor: 300,
    period_refunds_total_minor: 0, perpetual_sales_total_minor: number * 300, perpetual_refunds_total_minor: 0,
    unsynced_count: 0, unsynced_total_minor: 0, software_version: '0.1.0', print_count: 0,
    breakdowns: { closed_by_name: user.displayName }, order_ids: [], movement_ids: [],
  }));
  const rows = selectClosureRows(closures, {
    from: '2026-10-01', to: '2026-10-02', registerId: 'register', storeKey: 'store',
  }, 'UTC');
  const csv = closuresCsv(rows, 'USD', [{ id: String(user.id), name: user.displayName }], 'Test store');
  expect(typeof csv).toBe('string');
  const [header, ...data] = csv.split('\r\n').map(line => line.split(',').map(cell => cell.slice(1, -1)));
  expect(header).toEqual(['Business day', 'Closure', 'Register', 'Store', 'Opened', 'Closed', 'Closer',
    'Expected (cash)', 'Counted (cash)', 'Variance (cash)', 'Status']);
  expect(csv).not.toContain('reports.');
  expect(data).toHaveLength(2);
  expect(data.map(row => row[0])).toEqual(['2026-10-02', '2026-10-01']);
  expect(data.map(row => row[1])).toEqual(['2', '1']);
  expect(data.map(row => row[header.indexOf('Closer')])).toEqual(['Paul', 'Paul']);
  expect(data.every(row => row[header.indexOf('Closer')] !== String(user.id))).toBe(true);
  expect(data.map(row => row[3])).toEqual(['Test store', 'Test store']);
  expect(data.map(row => row.slice(7, 10))).toEqual([
    ['103.00', '103.00', '0.00 Exact'], ['103.00', '103.00', '0.00 Exact'],
  ]);
});

test('the Closer column names a roster cashier, reads Cashier #id for an unknown one, and keeps a stamped name', () => {
  // The closures list's resolver (lib/auth/cashier-name.ts) for a closure with no stamped closed_by_name; v2 export-csv.ts:55 otherwise.
  const closer = (number: number, closed_by: string | null, closed_by_name = ''): Closure => ({
    id: `session-${number}`, session_id: `session-${number}`, register_id: 'register', store_key: 'store', business_day: '2026-10-01',
    number, opened_at: '2026-10-01T09:00:00Z', closed_at: '2026-10-01T17:00:00Z', closed_by,
    till_expected: {}, expected: {}, counted: {}, variance: {}, period_sales_total_minor: 0,
    period_refunds_total_minor: 0, perpetual_sales_total_minor: 0, perpetual_refunds_total_minor: 0,
    unsynced_count: 0, unsynced_total_minor: 0, software_version: '0.1.0', print_count: 0,
    breakdowns: { closed_by_name }, order_ids: [], movement_ids: [],
  });
  const cashiers = [{ id: '2', name: 'Paul' }, { id: '5', name: 'Ann' }];
  const csv = closuresCsv([closer(1, '5'), closer(2, '7'), closer(3, '2'), closer(4, '5', 'Pat'), closer(5, null)], 'USD', cashiers, 'Test store');
  const [header, ...data] = csv.split('\r\n').map(line => line.split(',').map(cell => cell.slice(1, -1)));
  const closers = Object.fromEntries(data.map(row => [row[header.indexOf('Closure')], row[header.indexOf('Closer')]]));
  expect(closers).toEqual({ 1: 'Ann', 2: 'Cashier #7', 3: 'Paul', 4: 'Pat', 5: 'Unknown cashier' });
});

// The closures list title's register part (components/closure-list.tsx:152).
const listRegister = (row: Closure) => typeof row.breakdowns.register_name === 'string' ? row.breakdowns.register_name : 'This till';
const atRegister = (number: number, register_id: string, register_name?: string): Closure => ({
  id: `session-${number}`, session_id: `session-${number}`, register_id, store_key: 'store', business_day: '2026-10-01',
  number, opened_at: '2026-10-01T09:00:00Z', closed_at: '2026-10-01T17:00:00Z', closed_by: null,
  till_expected: {}, expected: {}, counted: {}, variance: {}, period_sales_total_minor: 0,
  period_refunds_total_minor: 0, perpetual_sales_total_minor: 0, perpetual_refunds_total_minor: 0,
  unsynced_count: 0, unsynced_total_minor: 0, software_version: '0.1.0', print_count: 0,
  breakdowns: register_name === undefined ? {} : { register_name }, order_ids: [], movement_ids: [],
});
const registerCells = (closures: Closure[]) => {
  const [header, ...data] = closuresCsv(closures, 'USD', [], 'Test store').split('\r\n').map(line => line.split(',').map(cell => cell.slice(1, -1)));
  return Object.fromEntries(data.map(row => [row[header.indexOf('Closure')], row[header.indexOf('Register')]]));
};

test("the Register cell names a closure's register as the closures list title does", () => {
  const cells = registerCells([atRegister(1, 'aaaaaaaa-1111-4111-8111-111111111111', 'Front counter'), atRegister(2, 'bbbbbbbb-2222-4222-8222-222222222222')]);
  expect(cells).toEqual({ 1: 'Front counter', 2: 'This till' });
  expect(Object.values(cells)).not.toContain('bbbbbbbb');
});

test('the Register cell and the closures list title agree for a named and an unnamed closure of the same register', () => {
  const register = 'cccccccc-3333-4333-8333-333333333333';
  const closures = [atRegister(1, register), atRegister(2, register, 'Front counter')];
  const cells = registerCells(closures);
  expect(cells).toEqual({ 1: 'This till', 2: 'Front counter' });
  for (const row of closures) expect(cells[row.number]).toBe(listRegister(row));
});
