import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { LogsScreen } from '../components/logs-screen';
import { logRecordId, logRecordSchema, type LogCollection, type LogRecord } from '../lib/logs/log-store';
import { buildDebugInfo, formatDurationMs } from '../lib/logs/log-view';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../lib/software';

const now = () => new Date(2026, 10, 10, 12, 0, 0).getTime();
const storeName = 'Test store';
const siteUrl = 'https://shop.example';
const props = { now, storeName, siteUrl, onBack: () => {} };
let db: RxDatabase;
let collection: LogCollection;
let rows: LogRecord[];

beforeEach(async () => {
  db = await createRxDatabase({ name: `logs_screen_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ logs: collection } = await db.addCollections<{ logs: LogCollection }>({ logs: { schema: logRecordSchema } }));
  rows = [
    { id: logRecordId(now(), 3), timestamp: now(), level: 'error', scope: 'tax', message: 'Tax failed' },
    { id: logRecordId(now() - 1000, 2), timestamp: now() - 1000, level: 'warn', scope: 'outbox',
      message: 'Order refused', code: 'refused', durationMs: 1500 },
    { id: logRecordId(now() - 2000, 1), timestamp: now() - 2000, level: 'info', scope: 'sale',
      message: 'Sale ready', outcome: 'ok' },
  ];
  for (const row of [...rows].reverse()) await collection.insert(row);
});

afterEach(async () => {
  cleanup();
  await db.close();
});

test('shows the v2 columns with the newest row first', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getAllByTestId(/^logs-heading-/).map(cell => [cell.getAttribute('data-testid'), cell.textContent]))
    .toEqual([['logs-heading-time', 'Time'], ['logs-heading-level', 'Level'], ['logs-heading-event', 'Event'],
      ['logs-heading-took', 'Took'], ['logs-heading-status', 'Status']]);
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid')))
    .toEqual(rows.map(row => `logs-row-${row.id}`));
  expect(screen.getByTestId(`logs-took-${rows[1].id}`).textContent).toBe('1.5 s');
  expect(screen.getByTestId(`logs-code-${rows[1].id}`).textContent).toBe('refused');
  expect(screen.getByTestId(`logs-ok-${rows[2].id}`).textContent).toBe('✓ ok');
  expect(screen.getByTestId(`logs-took-${rows[0].id}`).textContent).toBe('—');
  expect(within(screen.getByTestId(`logs-row-${rows[0].id}`)).getAllByText('—')).toHaveLength(2);
});

test('shows a row logged after the page opened', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  const row: LogRecord = { id: logRecordId(now() + 1000, 4), timestamp: now() + 1000,
    level: 'warn', scope: 'outbox', message: 'New log' };
  await act(async () => { await collection.insert(row); });
  await waitFor(() => expect(screen.getByTestId(`logs-row-${row.id}`)).not.toBeNull());
});

test('the Errors and Sync presets filter the rows and the footer count', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${rows[0].id}`]);
  expect(screen.getByTestId('logs-chip-errors').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('logs-chip-all').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 1 of 3');
  fireEvent.click(screen.getByTestId('logs-chip-sync'));
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${rows[1].id}`]);
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 1 of 3');
  fireEvent.click(screen.getByTestId('logs-chip-all'));
  expect(screen.getAllByTestId(/^logs-row-/)).toHaveLength(3);
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 3 of 3');
});

test('a level pill filters to that level and the kind chip clears it', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  fireEvent.click(await screen.findByTestId(`logs-pill-${rows[1].id}`));
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${rows[1].id}`]);
  expect(screen.getByTestId('logs-chip-kind').textContent).toBe('warn ×');
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  expect(screen.getByTestId('logs-empty').textContent).toBe('No logs found');
  fireEvent.click(screen.getByTestId('logs-chip-kind'));
  expect(screen.queryByTestId('logs-chip-kind')).toBeNull();
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${rows[0].id}`]);
});

test('Copy debug info copies the debug text and confirms', async () => {
  const copyText = vi.fn().mockResolvedValue(undefined);
  render(<LogsScreen {...props} collection={collection} copyText={copyText} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  fireEvent.click(screen.getByTestId('logs-copy-debug'));
  await waitFor(() => expect(screen.getByTestId('logs-copy-status').textContent).toBe('Debug info copied'));
  expect(copyText).toHaveBeenCalledTimes(1);
  expect(copyText).toHaveBeenCalledWith(buildDebugInfo({ now: now(), storeName, siteUrl, rows }));
});

test('a failed copy says so', async () => {
  render(<LogsScreen {...props} collection={collection} copyText={vi.fn().mockRejectedValue(new Error('denied'))} />);
  fireEvent.click(screen.getByTestId('logs-copy-debug'));
  await waitFor(() => expect(screen.getByTestId('logs-copy-status').textContent).toBe("Couldn't copy debug info"));
});

test('hides Copy debug info when there is no clipboard', () => {
  render(<LogsScreen {...props} collection={collection} copyText={null} />);
  expect(screen.queryByTestId('logs-copy-debug')).toBeNull();
});

test("buildDebugInfo lists the store, today's counts and the recent errors", () => {
  const yesterday = new Date(2026, 10, 9, 12, 0, 0).getTime();
  const debugRows: LogRecord[] = [
    { ...rows[0], code: 'tax_failed' },
    { ...rows[1], level: 'error', code: undefined },
    { ...rows[2], level: 'warn' },
    { id: logRecordId(yesterday, 4), timestamp: yesterday, level: 'error', scope: 'sale', message: 'Old error' },
  ];
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: debugRows })).toBe([
    `${SOFTWARE_NAME} debug info — ${new Date(now()).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    'Events today: 3', 'Errors today: 2', '', 'Recent errors (3):',
    `  - ${new Date(now()).toISOString()} | tax_failed | tax | Tax failed`,
    `  - ${new Date(now() - 1000).toISOString()} | - | outbox | Order refused`,
    `  - ${new Date(yesterday).toISOString()} | - | sale | Old error`,
  ].join('\n'));
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [rows[1], rows[2]] }))
    .toMatch(/Recent errors \(0\):\n  none$/);
});

test('formatDurationMs follows v2', () => {
  expect(formatDurationMs(999)).toBe('999 ms');
  expect(formatDurationMs(1500)).toBe('1.5 s');
  expect(formatDurationMs(61000)).toBe('1m 01s');
  expect(formatDurationMs(undefined)).toBeNull();
  expect(formatDurationMs(-1)).toBeNull();
  expect(formatDurationMs(NaN)).toBeNull();
});
