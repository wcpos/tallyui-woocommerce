import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type OutboxState, type PosOrder } from '@tallyui/pos';
import { StuckRecordsBanner } from '../components/stuck-records-banner';

const mocks = vi.hoisted(() => ({ outbox: { enabled: false } as any, push: vi.fn() }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => mocks.outbox }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mocks.push }) }));

let db: RxDatabase;
let orders: RxCollection<PosOrder>;
beforeEach(async () => {
  mocks.push.mockReset();
  mocks.outbox = { enabled: false };
  db = await createRxDatabase({ name: `stuck_banner_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  orders = await addPosOrderCollection(db);
});
afterEach(async () => { cleanup(); await db.close(); });

function insertOrder(id: string, commandId: string, extra: Partial<PosOrder> = {}) {
  return orders.insert({ id, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId, syncStatus: 'pending', ...extra });
}

// The outbox with these stuck orders, given in any order (outboxSyncStats sorts them oldest first).
function openOutbox(stuck: { commandId: string; since: number; reason: string }[], extra: Partial<OutboxState> = {}) {
  const state: OutboxState = { pending: stuck.length, sending: false, ...extra, ...(stuck.length ? { stuck: {
    commandIds: stuck.map(order => order.commandId), since: Math.min(...stuck.map(order => order.since)),
    reason: stuck[stuck.length - 1].reason, orders: stuck } } : {}) };
  mocks.outbox = { enabled: true, orders, state, flush: vi.fn(async () => {}) };
}

test('hidden when nothing is stuck', () => {
  openOutbox([]);
  render(<StuckRecordsBanner />);
  expect(screen.queryByTestId('db-attention-panel')).toBeNull();
});

test('hidden without an open outbox', () => {
  render(<StuckRecordsBanner />);
  expect(screen.queryByTestId('db-attention-panel')).toBeNull();
});

test('one stuck record reads singular, with its reason and "A sale" when the outbox has no such order', () => {
  openOutbox([{ commandId: 'cmd-missing', since: 1000, reason: 'Server error 500' }]);
  render(<StuckRecordsBanner />);
  expect(screen.getByTestId('db-attention-panel')).not.toBeNull();
  expect(screen.getByTestId('db-attention-title').textContent).toBe('1 record needs attention');
  expect(screen.getByTestId('db-attention-reason').textContent).toBe('"A sale" can\'t upload — Server error 500');
  expect(screen.getByTestId('db-attention-panel').textContent).not.toContain('cmd-missing');
  expect(screen.queryByTestId('db-attention-fix')).toBeNull();
});

test('several read plural, and the description names the oldest failing sale by its order reference', async () => {
  await insertOrder('0190aaaa-0000-7000-8000-00000000old1', 'cmd-old', { serverRefs: { orderId: '99', displayId: '1234', totalMinor: 100 } });
  await insertOrder('0190aaaa-0000-7000-8000-00000000new2', 'cmd-new');
  openOutbox([
    { commandId: 'cmd-new', since: 5000, reason: 'Newest reason' },
    { commandId: 'cmd-old', since: 1000, reason: 'Oldest reason' },
  ]);
  render(<StuckRecordsBanner />);
  expect(screen.getByTestId('db-attention-title').textContent).toBe('2 records need attention');
  // orderReference: the local reference, then the store's number once it has one (as Orders and the receipt show it).
  expect(await screen.findByText('"0000old1 · #1234" can\'t upload — Oldest reason')).not.toBeNull();
  expect(screen.getByTestId('db-attention-panel').textContent).not.toContain('cmd-old');
});

test('a local sale with no server number is named by its local reference', async () => {
  await insertOrder('0190aaaa-0000-7000-8000-0000abcd1234', 'cmd-local');
  openOutbox([{ commandId: 'cmd-local', since: 1000, reason: 'Timed out' }]);
  render(<StuckRecordsBanner />);
  expect(await screen.findByText('"abcd1234" can\'t upload — Timed out')).not.toBeNull();
});

test('View log goes to /health/logs', () => {
  openOutbox([{ commandId: 'cmd-1', since: 1000, reason: 'Server error 500' }]);
  render(<StuckRecordsBanner />);
  fireEvent.click(screen.getByTestId('db-attention-view-log'));
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/health/logs');
});

test("Retry calls the outbox's flush", () => {
  openOutbox([{ commandId: 'cmd-1', since: 1000, reason: 'Server error 500' }]);
  render(<StuckRecordsBanner />);
  fireEvent.click(screen.getByTestId('db-attention-retry'));
  expect(mocks.outbox.flush).toHaveBeenCalledOnce();
});

test('refused orders alone count, with no description and no Retry (the refused panel sends those again)', () => {
  openOutbox([], { rejected: 2 });
  render(<StuckRecordsBanner />);
  expect(screen.getByTestId('db-attention-title').textContent).toBe('2 records need attention');
  expect(screen.queryByTestId('db-attention-reason')).toBeNull();
  expect(screen.queryByTestId('db-attention-retry')).toBeNull();
  expect(screen.getByTestId('db-attention-view-log')).not.toBeNull();
});
