import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { LogsScreen } from '../components/logs-screen';
import { logRecordId, logRecordSchema, type LogCollection, type LogRecord } from '../lib/logs/log-store';
import { buildDebugInfo, formatDurationMs, logStats, matchesLogFilter } from '../lib/logs/log-view';
import { setVerboseDiagnostics } from '../lib/logs/verbose';
import { memoryStorage } from './memory-storage';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../lib/software';

const now = () => new Date(2026, 10, 10, 12, 0, 0).getTime();
const storeName = 'Test store';
const siteUrl = 'https://shop.example';
const props = { now, storeName, siteUrl, onBack: () => {} };
let db: RxDatabase;
let collection: LogCollection;
let rows: LogRecord[];
const yesterday = new Date(2026, 10, 9, 12, 0, 0).getTime();

// react-native-web drops className from the DOM, so read it off the component that took the testID. The node keeps
// the fiber it was created with, which after an update can be the stale alternate: take the one holding its props.
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber; alternate?: Fiber };
function classesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(node).find(name => name.startsWith(prefix))!;
  const created = node[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === node[key('__reactProps$')] ? created : created.alternate;
  const found: string[] = [];
  for (; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
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
  vi.unstubAllGlobals();
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
  expect(copyText).toHaveBeenCalledWith(buildDebugInfo({ now: now(), storeName, siteUrl, rows, verbose: false }));
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

test("buildDebugInfo lists the store, today's counts, verbose diagnostics and the recent errors", () => {
  const debugRows: LogRecord[] = [
    { ...rows[0], code: 'tax_failed' },
    { ...rows[1], level: 'error', code: undefined },
    { ...rows[2], level: 'warn' },
    { id: logRecordId(yesterday, 4), timestamp: yesterday, level: 'error', scope: 'sale', message: 'Old error' },
  ];
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: debugRows, verbose: false })).toBe([
    `${SOFTWARE_NAME} debug info — ${new Date(now()).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    'Events today: 3', 'Errors today: 2', 'Verbose diagnostics: off', '', 'Recent errors (3):',
    `  - ${new Date(now()).toISOString()} | tax_failed | tax | Tax failed`,
    `  - ${new Date(now() - 1000).toISOString()} | - | outbox | Order refused`,
    `  - ${new Date(yesterday).toISOString()} | - | sale | Old error`,
  ].join('\n'));
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [rows[1], rows[2]], verbose: false }))
    .toMatch(/Recent errors \(0\):\n  none$/);
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [], verbose: true }))
    .toContain('Errors today: 0\nVerbose diagnostics: on\n');
});

test('a debug row matches All and Sync only while verbose is on, and never Errors', () => {
  const debugRow: LogRecord = { id: 'd', timestamp: now(), level: 'debug', scope: 'outbox', message: 'Detail' };
  for (const preset of ['all', 'sync', 'errors'] as const) expect(matchesLogFilter(debugRow, preset)).toBe(false);
  expect(matchesLogFilter(debugRow, 'all', undefined, true)).toBe(true);
  expect(matchesLogFilter(debugRow, 'sync', undefined, true)).toBe(true);
  expect(matchesLogFilter(debugRow, 'errors', undefined, true)).toBe(false);
  expect(matchesLogFilter({ ...debugRow, scope: 'sale' }, 'sync', undefined, true)).toBe(false);
  expect(matchesLogFilter(debugRow, 'all', 'debug', true)).toBe(true);
  expect(matchesLogFilter(rows[0], 'errors', undefined, true)).toBe(true);
});

test("logStats counts today's events and errors only", () => {
  const old: LogRecord = { id: 'y', timestamp: yesterday, level: 'error', scope: 'sale', message: 'Old error' };
  const midnight: LogRecord = { ...old, id: 'm', timestamp: new Date(2026, 10, 10, 0, 0, 0).getTime() };
  expect(logStats([...rows, old, midnight], now())).toEqual({ eventsToday: 4, errorsToday: 2 });
  expect(logStats([old], now())).toEqual({ eventsToday: 0, errorsToday: 0 });
});

test("the stat strip shows today's events and errors, and yesterday's rows are not counted", async () => {
  await collection.insert({ id: logRecordId(yesterday, 0), timestamp: yesterday, level: 'error', scope: 'sale', message: 'Old error' });
  render(<LogsScreen {...props} collection={collection} copyText={vi.fn()} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  const strip = screen.getByTestId('logs-stats');
  expect(within(strip).getByTestId('logs-stat-events').textContent).toBe('3events today');
  expect(within(strip).getByTestId('logs-stat-errors').textContent).toBe('1errors today');
  expect(within(strip).getByTestId('logs-copy-debug')).not.toBeNull();
});

test('pressing errors today selects the Errors chip, and its value reads destructive', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(classesOf('logs-stat-errors-value')).toContain('text-destructive');
  expect(classesOf('logs-stat-events-value')).not.toContain('text-destructive');
  fireEvent.click(screen.getByTestId('logs-stat-errors'));
  expect(screen.getByTestId('logs-chip-errors').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${rows[0].id}`]);
  fireEvent.click(screen.getByTestId('logs-stat-events'));
  expect(screen.getByTestId('logs-chip-all').getAttribute('aria-pressed')).toBe('true');
});

test('errors today is not destructive at 0', async () => {
  await collection.find({ selector: { level: 'error' } }).remove();
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[1].id}`);
  expect(screen.getByTestId('logs-stat-errors').textContent).toBe('0errors today');
  expect(classesOf('logs-stat-errors-value')).not.toContain('text-destructive');
});

test('the verbose chip toggles, and a stored debug row shows under All only while it is on', async () => {
  const debugRow: LogRecord = { id: logRecordId(now() + 1000, 9), timestamp: now() + 1000, level: 'debug', scope: 'sale', message: 'Detail' };
  await collection.insert(debugRow);
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  const chip = () => screen.getByTestId('logs-chip-verbose');
  expect(chip().textContent).toBe('Verbose diagnostics: off');
  expect(chip().getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByTestId(`logs-row-${debugRow.id}`)).toBeNull();
  expect(screen.getByTestId('logs-stat-events').textContent).toBe('3events today');
  fireEvent.click(chip());
  expect(chip().textContent).toBe('Verbose diagnostics: on');
  expect(chip().getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId(`logs-row-${debugRow.id}`)).not.toBeNull();
  expect(screen.getByTestId('logs-stat-events').textContent).toBe('4events today');
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  expect(screen.queryByTestId(`logs-row-${debugRow.id}`)).toBeNull();
  fireEvent.click(screen.getByTestId('logs-chip-all'));
  fireEvent.click(chip());
  expect(chip().textContent).toBe('Verbose diagnostics: off');
  expect(chip().getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByTestId(`logs-row-${debugRow.id}`)).toBeNull();
});

test('the verbose chip turns itself off when the 24 h lapse while the page is open', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  try {
    let clock = now();
    setVerboseDiagnostics(true, clock);
    render(<LogsScreen {...props} now={() => clock} collection={collection} />);
    expect(screen.getByTestId('logs-chip-verbose').textContent).toBe('Verbose diagnostics: on');
    clock += 24 * 60 * 60 * 1000 + 1;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('logs-chip-verbose').textContent).toBe('Verbose diagnostics: off');
  } finally {
    vi.useRealTimers();
  }
});

test('formatDurationMs follows v2', () => {
  expect(formatDurationMs(999)).toBe('999 ms');
  expect(formatDurationMs(1500)).toBe('1.5 s');
  expect(formatDurationMs(61000)).toBe('1m 01s');
  expect(formatDurationMs(undefined)).toBeNull();
  expect(formatDurationMs(-1)).toBeNull();
  expect(formatDurationMs(NaN)).toBeNull();
});
