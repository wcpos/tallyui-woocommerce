import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { OutboxState } from '@tallyui/pos';
import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { BehaviorSubject } from 'rxjs';
import { LogsScreen } from '../components/logs-screen';
import { logRecordId, logRecordMigrationStrategies, logRecordSchema, type LogCollection, type LogRecord } from '../lib/logs/log-store';
import { IDLE_OUTBOX_STATE, buildDebugInfo, buildLogEntryReport, formatDurationMs, formatLogTime, logStats, matchesLogFilter, outboxSyncStats,
  type OutboxSyncStats } from '../lib/logs/log-view';
import { setVerboseDiagnostics } from '../lib/logs/verbose';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { memoryStorage } from './memory-storage';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../lib/software';

addRxPlugin(RxDBMigrationSchemaPlugin);

const now = () => new Date(2026, 10, 10, 12, 0, 0).getTime();
const storeName = 'Test store';
const siteUrl = 'https://shop.example';
const props = { now, storeName, siteUrl };
let db: RxDatabase;
let collection: LogCollection;
let rows: LogRecord[];
const yesterday = new Date(2026, 10, 9, 12, 0, 0).getTime();
const idle = outboxSyncStats(IDLE_OUTBOX_STATE);
// An outbox state with the given stuck orders, in the order given.
function withStuck(state: Omit<OutboxState, 'sending' | 'stuck'>, orders: { commandId: string; since: number; reason: string }[]): OutboxState {
  return { sending: false, ...state, stuck: { commandIds: orders.map(order => order.commandId),
    since: Math.min(...orders.map(order => order.since)), reason: orders[orders.length - 1].reason, orders } };
}

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
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  vi.stubGlobal('localStorage', memoryStorage());
  db = await createRxDatabase({ name: `logs_screen_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ logs: collection } = await db.addCollections<{ logs: LogCollection }>({
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } }));
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
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  await db.close();
  vi.unstubAllGlobals();
});

test('shows the v2 columns with the newest row first', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getAllByTestId(/^logs-heading-/).map(cell => [cell.getAttribute('data-testid'), cell.textContent]))
    .toEqual([['logs-heading-time', 'Time'], ['logs-heading-level', 'Level'], ['logs-heading-event', 'Event'],
      ['logs-heading-took', 'Took'], ['logs-heading-status', 'Status']]);
  for (const id of ['time', 'level', 'event', 'took', 'status']) {
    expect(classesOf(`logs-heading-${id}`)).toEqual(expect.arrayContaining(['uppercase', 'text-xs', 'text-muted-foreground']));
  }
  expect(classesOf('logs-heading-took')).toContain('text-right');
  expect(classesOf('logs-heading-status')).toContain('text-right');
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid')))
    .toEqual(rows.map(row => `logs-row-${row.id}`));
  expect(screen.getByTestId(`logs-took-${rows[1].id}`).textContent).toBe('1.5 s');
  expect(screen.getByTestId(`logs-code-${rows[1].id}`).textContent).toBe('refused');
  expect(screen.getByTestId(`logs-ok-${rows[2].id}`).textContent).toBe('✓ ok');
  expect(screen.getByTestId(`logs-took-${rows[0].id}`).textContent).toBe('—');
  expect(within(screen.getByTestId(`logs-row-${rows[0].id}`)).getAllByText('—')).toHaveLength(2);
});

test('on a phone the table head is hidden, and a row shows its time and level, then its event, then its scope and duration', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  render(<LogsScreen {...props} collection={collection} />);
  const id = rows[1].id;
  await screen.findByTestId(`logs-row-sm-${id}`);
  expect(screen.queryAllByTestId(/^logs-heading-/)).toHaveLength(0);
  const time = screen.getByTestId(`logs-time-sm-${id}`);
  const level = screen.getByTestId(`logs-level-sm-${id}`);
  const line = screen.getByTestId(`logs-line-sm-${id}`);
  const event = screen.getByTestId(`logs-event-sm-${id}`);
  expect(time.textContent).toBe(formatLogTime(rows[1].timestamp, now()));
  expect(level.textContent).toBe('warn');
  expect(line.contains(time)).toBe(true);
  expect(line.contains(level)).toBe(true);
  expect(line.contains(event)).toBe(false);
  expect(event.textContent).toBe('Order refused');
  expect(screen.getByTestId(`logs-subline-sm-${id}`).textContent).toBe('outbox·1.5 s');
  expect(screen.getByTestId(`logs-subline-sm-${rows[0].id}`).textContent).toBe('tax');
  expect(screen.queryByTestId(`logs-took-sm-${rows[0].id}`)).toBeNull();
  expect(screen.getByTestId(`logs-code-${id}`).textContent).toBe('refused');
  expect(screen.getByTestId(`logs-ok-${rows[2].id}`)).not.toBeNull();
  expect(screen.queryByTestId(`logs-toggle-${id}`)).toBeNull();
  expect(screen.queryByTestId(`logs-took-${id}`)).toBeNull();
});

test('pressing a phone row opens its detail, indented as v2 does on a phone, and pressing again hides it', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  render(<LogsScreen {...props} collection={collection} />);
  const id = rows[1].id;
  const row = await screen.findByTestId(`logs-row-sm-${id}`);
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
  fireEvent.click(row);
  expect(screen.getByTestId(`logs-detail-${id}-code`).textContent).toBe('refused');
  expect(row.getAttribute('aria-expanded')).toBe('true');
  expect(classesOf(`logs-detail-${id}`)).toContain('pl-4');
  expect(classesOf(`logs-detail-${id}`)).not.toContain('ml-42');
  expect(screen.getByTestId(`logs-chevron-${id}-down`)).not.toBeNull();
  expect(screen.queryByTestId(`logs-chevron-${id}-right`)).toBeNull();
  fireEvent.click(row);
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
});

test('off a phone the table head and the table row stay, with no phone row', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  const id = rows[1].id;
  await screen.findByTestId(`logs-row-${id}`);
  for (const heading of ['time', 'level', 'event', 'took', 'status']) {
    expect(screen.getByTestId(`logs-heading-${heading}`)).not.toBeNull();
  }
  expect(screen.getByTestId(`logs-toggle-${id}`)).not.toBeNull();
  expect(screen.getByTestId(`logs-pill-${id}`)).not.toBeNull();
  expect(screen.getByTestId(`logs-took-${id}`)).not.toBeNull();
  expect(screen.queryByTestId(`logs-row-sm-${id}`)).toBeNull();
  fireEvent.click(screen.getByTestId(`logs-toggle-${id}`));
  expect(classesOf(`logs-detail-${id}`)).toContain('ml-42');
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

const shownRows = () => screen.queryAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'));
const searchFor = (value: string) => fireEvent.change(screen.getByTestId('search-logs'), { target: { value } });

test('the search narrows the rows by message, code and scope with the case ignored, and the footer follows', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getByTestId('search-logs').getAttribute('placeholder')).toBe('Search Logs');
  searchFor('TAX');
  await waitFor(() => expect(shownRows()).toEqual([`logs-row-${rows[0].id}`]));
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 1 of 1');
  searchFor('OutBox');
  await waitFor(() => expect(shownRows()).toEqual([`logs-row-${rows[1].id}`]));
  searchFor('ED');
  await waitFor(() => expect(shownRows()).toEqual([`logs-row-${rows[0].id}`, `logs-row-${rows[1].id}`]));
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 2 of 2');
});

test('the search combines with the Errors preset, and no match shows the empty text', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  searchFor('ed');
  await waitFor(() => expect(shownRows()).toHaveLength(2));
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  expect(shownRows()).toEqual([`logs-row-${rows[0].id}`]);
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 1 of 2');
  searchFor('nothing like this');
  await waitFor(() => expect(screen.getByTestId('logs-empty').textContent).toBe('No logs found'));
  expect(shownRows()).toEqual([]);
  // v2's Logs empty row is inline: no glyph above the text (empty-state/index.tsx:62).
  expect(within(screen.getByTestId('logs-empty')).queryByTestId('no-data-message-glyph')).toBeNull();
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 0 of 0');
});

test("each row's chevron opens its detail with the row's fields, and pressing again hides it", async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  for (const row of rows) expect(screen.getByTestId(`logs-chevron-${row.id}-right`)).not.toBeNull();
  const id = rows[1].id;
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
  fireEvent.click(screen.getByTestId(`logs-chevron-${id}`));
  expect(screen.getByTestId(`logs-detail-${id}-code`).textContent).toBe('refused');
  expect(screen.getByTestId(`logs-detail-${id}-duration`).textContent).toBe('1.5 s');
  expect(screen.getByTestId(`logs-detail-${id}-log-id`).textContent).toBe(id);
  expect(screen.queryByTestId(`logs-detail-${id}-actor`)).toBeNull();
  expect(screen.queryByTestId(`logs-detail-${rows[0].id}`)).toBeNull();
  fireEvent.click(screen.getByTestId(`logs-chevron-${id}`));
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
  fireEvent.click(screen.getByTestId(`logs-toggle-${id}`));
  expect(screen.getByTestId(`logs-detail-${id}`)).not.toBeNull();
});

test("an error or warn row with a code shows v2's code chip in the destructive tint, and pressing it toggles the row", async () => {
  render(<LogsScreen {...props} collection={collection} />);
  const id = rows[1].id;
  const chip = await screen.findByTestId(`logs-code-${id}`);
  expect(classesOf(`logs-code-${id}`)).toEqual(expect.arrayContaining(['bg-destructive/15', 'rounded-md', 'px-2', 'py-0.5', 'z-20']));
  expect(classesOf(`logs-code-${id}-label`)).toEqual(expect.arrayContaining(['text-destructive', 'font-mono', 'font-semibold', 'text-xs']));
  expect(chip.getAttribute('role')).toBe('button');
  expect(chip.getAttribute('aria-label')).toBe('refused');
  // react-native-web gives each View z-index 0: the status cell itself sits above the row's z-10 overlay.
  expect(classesOf(`logs-status-${id}`)).toContain('z-20');
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
  fireEvent.click(chip);
  expect(screen.getByTestId(`logs-detail-${id}`)).not.toBeNull();
  fireEvent.click(screen.getByTestId(`logs-code-${id}`));
  expect(screen.queryByTestId(`logs-detail-${id}`)).toBeNull();
});

test("the chevron is v2's right icon while collapsed and its down icon while expanded, with no text glyph", async () => {
  render(<LogsScreen {...props} collection={collection} />);
  const id = rows[1].id;
  const chevron = await screen.findByTestId(`logs-chevron-${id}`);
  expect(screen.getByTestId(`logs-chevron-${id}-right`)).not.toBeNull();
  expect(screen.queryByTestId(`logs-chevron-${id}-down`)).toBeNull();
  expect(chevron.textContent).not.toMatch(/[›⌄]/);
  expect(classesOf(`logs-chevron-${id}-right`)).toContain('text-muted-foreground/60');
  fireEvent.click(screen.getByTestId(`logs-toggle-${id}`));
  expect(screen.getByTestId(`logs-chevron-${id}-down`)).not.toBeNull();
  expect(screen.queryByTestId(`logs-chevron-${id}-right`)).toBeNull();
  expect(classesOf(`logs-chevron-${id}-down`)).toContain('text-muted-foreground/60');
});

test("each row has v2's hairline rule", async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  for (const row of rows) {
    expect(classesOf(`logs-row-${row.id}`)).toContain('border-border/50');
    expect(classesOf(`logs-row-${row.id}`)).not.toContain('border-border');
  }
});

test("the row's press target is labelled time · level · message, wide and on a phone", async () => {
  const id = rows[1].id;
  const label = `${formatLogTime(rows[1].timestamp, now())} · warn · Order refused`;
  render(<LogsScreen {...props} collection={collection} />);
  expect((await screen.findByTestId(`logs-toggle-${id}`)).getAttribute('aria-label')).toBe(label);
  cleanup();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  render(<LogsScreen {...props} collection={collection} />);
  expect((await screen.findByTestId(`logs-row-sm-${id}`)).getAttribute('aria-label')).toBe(label);
});

test('the chips are rounded, in v2\'s borderless selected tint and ink when on, and keep aria-pressed as they are pressed', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(classesOf('logs-chip-all')).toEqual(expect.arrayContaining(['rounded-full', 'border-selected', 'bg-selected']));
  expect(classesOf('logs-chip-all')).not.toContain('border-primary');
  expect(classesOf('logs-chip-all-label')).toContain('text-selected-foreground');
  expect(classesOf('logs-chip-sync')).toEqual(expect.arrayContaining(['rounded-full', 'border-border', 'bg-card']));
  expect(classesOf('logs-chip-sync-label')).toContain('text-foreground');
  fireEvent.click(screen.getByTestId('logs-chip-sync'));
  expect(screen.getByTestId('logs-chip-sync').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('logs-chip-all').getAttribute('aria-pressed')).toBe('false');
  expect(classesOf('logs-chip-sync')).toContain('bg-selected');
  expect(classesOf('logs-chip-all')).not.toContain('bg-selected');
  fireEvent.click(screen.getByTestId('logs-chip-verbose'));
  expect(screen.getByTestId('logs-chip-verbose').getAttribute('aria-pressed')).toBe('true');
  expect(classesOf('logs-chip-verbose')).toContain('bg-selected');
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

test('pressing the active level pill again clears the level filter', async () => {
  render(<LogsScreen {...props} collection={collection} />);
  fireEvent.click(await screen.findByTestId(`logs-pill-${rows[1].id}`));
  expect(screen.getByTestId('logs-chip-kind').textContent).toBe('warn ×');
  expect(shownRows()).toEqual([`logs-row-${rows[1].id}`]);
  fireEvent.click(screen.getByTestId(`logs-pill-${rows[1].id}`));
  expect(screen.queryByTestId('logs-chip-kind')).toBeNull();
  expect(shownRows()).toHaveLength(rows.length);
});

test('a row detail Copy copies the whole entry in v2\'s format and confirms', async () => {
  const row: LogRecord = { id: logRecordId(now() - 5000, 9), timestamp: now() - 5000, level: 'warn', scope: 'outbox', message: 'Order refused',
    code: 'refused', outcome: 'failed', durationMs: 1500, actor: { name: 'Ada', role: 'cashier', id: '7' },
    syncRecord: { collection: 'orders', recordId: 'o1', outcome: 'failed', reason: 'HTTP 400' },
    detail: '{"code":"refused","status":400}' };
  await collection.insert(row);
  const copyText = vi.fn().mockResolvedValue(undefined);
  render(<LogsScreen {...props} collection={collection} copyText={copyText} />);
  await screen.findByTestId(`logs-row-${row.id}`);
  fireEvent.click(screen.getByTestId(`logs-toggle-${row.id}`));
  fireEvent.click(screen.getByTestId(`logs-copy-event-${row.id}`));
  await waitFor(() => expect(getToasts().map(({ type, title }) => ({ type, title }))).toEqual([{ type: 'success', title: 'Log entry copied' }]));
  expect(copyText).toHaveBeenCalledTimes(1);
  expect(copyText).toHaveBeenCalledWith(`TallyUI WooCommerce POS log entry — ${new Date(now() - 5000).toISOString()}
Level: warn
Error code: refused
Category: outbox
Actor: Ada (cashier, id 7)
Outcome: failed
Message: Order refused
Request: 1.5 s
Record: orders o1 · failed
Reason: HTTP 400
Log id: ${row.id}
Details:
{
  "code": "refused",
  "status": 400
}`);
});

test('a row detail Copy that fails says so', async () => {
  const row: LogRecord = { id: logRecordId(now() - 5000, 9), timestamp: now() - 5000, level: 'warn', scope: 'outbox', message: 'Order refused',
    code: 'refused', outcome: 'failed', durationMs: 1500, actor: { name: 'Ada', role: 'cashier', id: '7' },
    syncRecord: { collection: 'orders', recordId: 'o1', outcome: 'failed', reason: 'HTTP 400' },
    detail: '{"code":"refused","status":400}' };
  await collection.insert(row);
  render(<LogsScreen {...props} collection={collection} copyText={vi.fn().mockRejectedValue(new Error('denied'))} />);
  await screen.findByTestId(`logs-row-${row.id}`);
  fireEvent.click(screen.getByTestId(`logs-toggle-${row.id}`));
  fireEvent.click(screen.getByTestId(`logs-copy-event-${row.id}`));
  await waitFor(() => expect(getToasts().map(({ type, title }) => ({ type, title }))).toEqual([{ type: 'error', title: "Couldn't copy the log entry" }]));
});

test('a row detail has no Copy without a clipboard', async () => {
  const row: LogRecord = { id: logRecordId(now() - 5000, 9), timestamp: now() - 5000, level: 'warn', scope: 'outbox', message: 'Order refused',
    code: 'refused', outcome: 'failed', durationMs: 1500, actor: { name: 'Ada', role: 'cashier', id: '7' },
    syncRecord: { collection: 'orders', recordId: 'o1', outcome: 'failed', reason: 'HTTP 400' },
    detail: '{"code":"refused","status":400}' };
  await collection.insert(row);
  render(<LogsScreen {...props} collection={collection} copyText={null} />);
  await screen.findByTestId(`logs-row-${row.id}`);
  fireEvent.click(screen.getByTestId(`logs-toggle-${row.id}`));
  expect(screen.queryByTestId(`logs-copy-event-${row.id}`)).toBeNull();
});

test('buildLogEntryReport keeps the lines a row has', () => {
  expect(buildLogEntryReport(rows[2])).toBe([
    `${SOFTWARE_NAME} log entry — ${new Date(rows[2].timestamp).toISOString()}`, 'Level: info', 'Category: sale',
    'Outcome: ok', 'Message: Sale ready', `Log id: ${rows[2].id}`,
  ].join('\n'));
  expect(buildLogEntryReport({ ...rows[2], actor: { id: '7' } })).toContain('\nActor: id 7\n');
  expect(buildLogEntryReport({ ...rows[2], detail: 'not json' })).toMatch(/Details:\nnot json$/);
});

test('Copy debug info copies the debug text and confirms', async () => {
  const copyText = vi.fn().mockResolvedValue(undefined);
  render(<LogsScreen {...props} collection={collection} copyText={copyText} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  fireEvent.click(screen.getByTestId('logs-chip-errors'));
  fireEvent.click(screen.getByTestId('logs-copy-debug'));
  await waitFor(() => expect(getToasts().map(({ type, title }) => ({ type, title }))).toEqual([{ type: 'success', title: 'Debug info copied' }]));
  expect(screen.queryByTestId('logs-copy-status')).toBeNull();
  expect(copyText).toHaveBeenCalledTimes(1);
  expect(copyText).toHaveBeenCalledWith(buildDebugInfo({ now: now(), storeName, siteUrl, rows, verbose: false, sync: idle }));
});

test("Copy debug info's text agrees with the stuck and waiting stats", async () => {
  const sync = outboxSyncStats(withStuck({ pending: 4, rejected: 1 },
    [{ commandId: 'c9', since: now() - 60_000, reason: 'HTTP 500' }]));
  const copyText = vi.fn().mockResolvedValue(undefined);
  render(<LogsScreen {...props} collection={collection} copyText={copyText} sync={sync} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getByTestId('logs-stat-stuck').textContent).toBe('2stuck records');
  expect(screen.getByTestId('logs-stat-waiting').textContent).toBe('4changes waiting to send');
  fireEvent.click(screen.getByTestId('logs-copy-debug'));
  await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1));
  const text = copyText.mock.calls[0][0] as string;
  expect(text).toContain('\nStuck records: 2\nChanges waiting to send: 4\n');
  expect(text.endsWith(['Stuck records (2):', `  - ${new Date(now() - 60_000).toISOString()} | failing | c9 | HTTP 500`,
    '  - 1 refused by the store: see Store health'].join('\n'))).toBe(true);
});

test('a failed copy says so', async () => {
  render(<LogsScreen {...props} collection={collection} copyText={vi.fn().mockRejectedValue(new Error('denied'))} />);
  fireEvent.click(screen.getByTestId('logs-copy-debug'));
  await waitFor(() => expect(getToasts().map(({ type, title }) => ({ type, title }))).toEqual([{ type: 'error', title: "Couldn't copy debug info" }]));
  expect(screen.queryByTestId('logs-copy-status')).toBeNull();
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
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: debugRows, verbose: false, sync: idle })).toBe([
    `${SOFTWARE_NAME} debug info — ${new Date(now()).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    'Events today: 3', 'Errors today: 2', 'Stuck records: 0', 'Changes waiting to send: 0', 'Verbose diagnostics: off',
    '', 'Recent errors (3):',
    `  - ${new Date(now()).toISOString()} | tax_failed | tax | Tax failed`,
    `  - ${new Date(now() - 1000).toISOString()} | - | outbox | Order refused`,
    `  - ${new Date(yesterday).toISOString()} | - | sale | Old error`,
    '', 'Stuck records (0):', '  none',
  ].join('\n'));
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [rows[1], rows[2]], verbose: false, sync: idle }))
    .toMatch(/Recent errors \(0\):\n  none\n\nStuck records \(0\):\n  none$/);
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [], verbose: true, sync: idle }))
    .toContain('Errors today: 0\nStuck records: 0\nChanges waiting to send: 0\nVerbose diagnostics: on\n');
});

test('buildDebugInfo prints the outbox stats it is given, with the refused line, not records derived from rows', () => {
  const sync = outboxSyncStats(withStuck({ pending: 5, rejected: 3 }, [
    { commandId: 'c2', since: now() - 1000, reason: 'HTTP 503' },
    { commandId: 'c1', since: now() - 2000, reason: 'HTTP 500' },
  ]));
  const text = buildDebugInfo({ now: now(), storeName, siteUrl, rows: [], verbose: false, sync });
  expect(text).toContain('Errors today: 0\nStuck records: 5\nChanges waiting to send: 5\nVerbose diagnostics: off\n');
  expect(text.endsWith(['', '', 'Stuck records (5):',
    `  - ${new Date(now() - 2000).toISOString()} | failing | c1 | HTTP 500`,
    `  - ${new Date(now() - 1000).toISOString()} | failing | c2 | HTTP 503`,
    '  - 3 refused by the store: see Store health',
  ].join('\n'))).toBe(true);
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [], verbose: false,
    sync: outboxSyncStats({ pending: 0, rejected: 2, sending: false }) }))
    .toMatch(/\nStuck records \(2\):\n  - 2 refused by the store: see Store health$/);
  const failedRow: LogRecord = { id: 'f', timestamp: now(), level: 'warn', scope: 'outbox', message: 'Refused',
    syncRecord: { collection: 'pos_orders', recordId: 'o3', outcome: 'failed' } };
  expect(buildDebugInfo({ now: now(), storeName, siteUrl, rows: [failedRow], verbose: false, sync: idle }))
    .toMatch(/\nStuck records: 0\nChanges waiting to send: 0\n[\s\S]*\nStuck records \(0\):\n  none$/);
});

test('buildDebugInfo lists at most 10 failing orders under the full count', () => {
  const orders = Array.from({ length: 11 }, (_, i) => ({ commandId: `c${i}`, since: now() - (11 - i) * 1000,
    reason: `Failing ${i}` })).reverse();
  const text = buildDebugInfo({ now: now(), storeName, siteUrl, rows: [], verbose: false,
    sync: outboxSyncStats(withStuck({ pending: 11 }, orders)) });
  expect(text).toContain('\nStuck records: 11\nChanges waiting to send: 11\n');
  const section = text.slice(text.indexOf('Stuck records (11):\n') + 'Stuck records (11):\n'.length).split('\n');
  expect(section).toHaveLength(10);
  expect(section.every(line => line.startsWith('  - ') && line.includes(' | failing | c'))).toBe(true);
  expect(section[0]).toContain('| c0 | Failing 0');
  expect(section[9]).toContain('| c9 | Failing 9');
  expect(text).not.toContain('| c10 |');
});

test('outboxSyncStats counts pending as waiting, rejected plus stuck as stuck, and lists the failing oldest first', () => {
  const sales = withStuck({ pending: 3, rejected: 2 }, [
    { commandId: 'new', since: now() - 1000, reason: 'HTTP 503' },
    { commandId: 'old', since: now() - 5000, reason: 'HTTP 500' },
  ]);
  const expected: OutboxSyncStats = { waiting: 3, stuck: 4, rejected: 2, failing: [
    { commandId: 'old', since: now() - 5000, reason: 'HTTP 500' },
    { commandId: 'new', since: now() - 1000, reason: 'HTTP 503' },
  ] };
  expect(outboxSyncStats(sales)).toEqual(expected);
  expect(outboxSyncStats(sales, IDLE_OUTBOX_STATE)).toEqual(expected);
  expect(outboxSyncStats(sales, { pending: 1, rejected: 1, sending: false }))
    .toEqual({ ...expected, waiting: 4, stuck: 5, rejected: 3 });
  expect(outboxSyncStats(IDLE_OUTBOX_STATE)).toEqual({ waiting: 0, stuck: 0, rejected: 0, failing: [] });
});


const actor = { id: '7', name: 'Jane', role: 'cashier' };

test('Actions matches only rows whose actor names someone, and debug ones only while verbose is on', () => {
  const action: LogRecord = { id: 'a', timestamp: now(), level: 'info', scope: 'register-facts', message: 'Drawer opened', actor };
  expect(matchesLogFilter(action, 'actions')).toBe(true);
  expect(matchesLogFilter({ ...action, actor: { name: 'Jane' } }, 'actions')).toBe(true);
  expect(matchesLogFilter(rows[2], 'actions')).toBe(false);
  expect(matchesLogFilter({ ...action, actor: { role: 'cashier' } }, 'actions')).toBe(false);
  expect(matchesLogFilter({ ...action, level: 'debug' }, 'actions')).toBe(false);
  expect(matchesLogFilter({ ...action, level: 'debug' }, 'actions', undefined, true)).toBe(true);
  expect(matchesLogFilter(action, 'actions', 'warn')).toBe(false);
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

test('the chips are All, Actions, Errors and Sync, and Actions lists only the rows with an actor', async () => {
  const action: LogRecord = { id: logRecordId(now() + 1000, 5), timestamp: now() + 1000, level: 'info',
    scope: 'register-facts', message: 'Drawer opened', actor };
  await collection.insert(action);
  render(<LogsScreen {...props} collection={collection} />);
  await screen.findByTestId(`logs-row-${action.id}`);
  expect(screen.getAllByTestId(/^logs-chip-(all|actions|errors|sync)$/).map(chip => [chip.getAttribute('data-testid'), chip.textContent]))
    .toEqual([['logs-chip-all', 'All'], ['logs-chip-actions', 'Actions'], ['logs-chip-errors', 'Errors'], ['logs-chip-sync', 'Sync']]);
  fireEvent.click(screen.getByTestId('logs-chip-actions'));
  expect(screen.getByTestId('logs-chip-actions').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getAllByTestId(/^logs-row-/).map(row => row.getAttribute('data-testid'))).toEqual([`logs-row-${action.id}`]);
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 1 of 4');
});

test('stuck records shows the outbox count with no log rows at all, reads destructive, and pressing it selects Sync', async () => {
  await collection.find().remove();
  render(<LogsScreen {...props} collection={collection}
    sync={outboxSyncStats({ pending: 2, rejected: 1, sending: false })} />);
  await screen.findByTestId('logs-empty');
  expect(screen.getByTestId('logs-stat-stuck').textContent).toBe('1stuck records');
  expect(classesOf('logs-stat-stuck-value')).toContain('text-destructive');
  fireEvent.click(screen.getByTestId('logs-stat-stuck'));
  expect(screen.getByTestId('logs-chip-sync').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('logs-chip-errors').getAttribute('aria-pressed')).toBe('false');
});

test('stuck records reads success at 0, and a failed syncRecord row does not count', async () => {
  await collection.insert({ id: logRecordId(now() + 1000, 6), timestamp: now() + 1000, level: 'warn', scope: 'outbox',
    message: 'Order refused', syncRecord: { collection: 'pos_orders', recordId: 'o1', outcome: 'failed' } });
  render(<LogsScreen {...props} collection={collection} sync={idle} />);
  await screen.findByTestId(`logs-row-${logRecordId(now() + 1000, 6)}`);
  expect(screen.getByTestId('logs-stat-stuck').textContent).toBe('0stuck records');
  expect(classesOf('logs-stat-stuck-value')).toContain('text-success');
});

test('changes waiting to send shows sync.waiting, reads by its count, is not pressable, and both stats are absent without sync', async () => {
  const waiting = (pending: number): OutboxSyncStats => outboxSyncStats({ pending, sending: false });
  const { rerender } = render(<LogsScreen {...props} collection={collection} sync={waiting(2)} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getByTestId('logs-stat-waiting').textContent).toBe('2changes waiting to send');
  expect(classesOf('logs-stat-waiting-value')).toContain('text-destructive');
  expect(screen.getByTestId('logs-stat-waiting').getAttribute('role')).toBeNull();
  expect(screen.getByTestId('logs-stat-stuck').getAttribute('role')).toBe('button');
  expect(screen.getAllByTestId(/^logs-stat-[a-z]+$/).map(stat => stat.getAttribute('data-testid')))
    .toEqual(['logs-stat-events', 'logs-stat-errors', 'logs-stat-stuck', 'logs-stat-waiting']);
  rerender(<LogsScreen {...props} collection={collection} sync={waiting(0)} />);
  expect(screen.getByTestId('logs-stat-waiting').textContent).toBe('0changes waiting to send');
  expect(classesOf('logs-stat-waiting-value')).toContain('text-success');
  rerender(<LogsScreen {...props} collection={collection} />);
  expect(screen.queryByTestId('logs-stat-waiting')).toBeNull();
  expect(screen.queryByTestId('logs-stat-stuck')).toBeNull();
});


test('the footer says when the next check is due, from the runner', async () => {
  const runner = { nextDueAtMs$: new BehaviorSubject<number | undefined>(now() + 42_000) };
  render(<LogsScreen {...props} collection={collection} runner={runner} />);
  await screen.findByTestId(`logs-row-${rows[0].id}`);
  expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes · next check ~42 s');
  expect(classesOf('logs-status-line-dot')).toEqual(expect.arrayContaining(['bg-success', 'size-1.5']));
  expect(screen.getByTestId('logs-footer').textContent).toBe('Showing 3 of 3');
});

test('a re-armed runner moves the line, in minutes past 90 s', () => {
  const subject = new BehaviorSubject<number | undefined>(now() + 42_000);
  render(<LogsScreen {...props} collection={collection} runner={{ nextDueAtMs$: subject }} />);
  act(() => subject.next(now() + 180_000));
  expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes · next check ~3 min');
});

test('an overdue check reads only Watching for changes', () => {
  const runner = { nextDueAtMs$: new BehaviorSubject<number | undefined>(now() - 1) };
  render(<LogsScreen {...props} collection={collection} runner={runner} />);
  expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes');
});

test('no runner draws no status line; before the first check it reads First check pending…', () => {
  const subject = new BehaviorSubject<number | undefined>(undefined);
  const { rerender } = render(<LogsScreen {...props} collection={collection} />);
  expect(screen.queryByTestId('logs-status-line')).toBeNull();
  rerender(<LogsScreen {...props} collection={collection} runner={{ nextDueAtMs$: subject }} />);
  // v2 logs/index.tsx:85-89, health.database.first_check_pending.
  expect(screen.getByTestId('logs-status-line-label').textContent).toBe('First check pending…');
  expect(classesOf('logs-status-line-dot')).toEqual(expect.arrayContaining(['bg-success', 'size-1.5']));
  act(() => subject.next(now() + 42_000));
  expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes · next check ~42 s');
});

test('the countdown follows the 5 s clock', () => {
  let t = now();
  const clock = () => t;
  const runner = { nextDueAtMs$: new BehaviorSubject<number | undefined>(t + 42_000) };
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  try {
    render(<LogsScreen {...props} collection={collection} now={clock} runner={runner} />);
    expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes · next check ~42 s');
    t += 10_000;
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByTestId('logs-status-line-label').textContent).toBe('Watching for changes · next check ~32 s');
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
