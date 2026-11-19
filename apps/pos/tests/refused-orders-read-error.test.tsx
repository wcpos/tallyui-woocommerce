import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { RxCollection } from 'rxdb';
import type { PosOrder } from '@tallyui/pos';
import { RejectedOrdersPanel } from '../components/rejected-orders-panel';
import { useRefusedOrdersRead } from '../lib/orders/use-refused-orders';

/** Each stand-in collection gets its own Subject, so a test drives the refused-orders read's next and error itself. */
const reads = vi.hoisted(() => new Map<object, import('rxjs').Subject<unknown[]>>());
vi.mock('@tallyui/pos', async importOriginal => {
  const pos = await importOriginal<typeof import('@tallyui/pos')>();
  const { Subject: RxSubject } = await import('rxjs');
  return { ...pos, watchFresh: vi.fn((collection: object) => {
    if (!reads.has(collection)) reads.set(collection, new RxSubject<unknown[]>());
    return reads.get(collection)!.asObservable();
  }) };
});
afterEach(() => { cleanup(); reads.clear(); });

const collection = () => ({}) as RxCollection<PosOrder>;
const subject = (orders: RxCollection<PosOrder>) => reads.get(orders) as Subject<PosOrder[]>;
const row = { id: 'r1', syncStatus: 'rejected', createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:55:00.000Z' } as PosOrder;
const TITLE = "Couldn't read recovery data";
const BODY = 'This panel could not check for refused changes, so it may be missing sales that only exist on this device. Reload this screen to try again.';
const panel = (orders: RxCollection<PosOrder>) => <RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />;

test('useRefusedOrdersRead: an erroring read gives the error and no rows; the next good emission clears it', () => {
  const a = collection(), b = collection();
  const { result, rerender } = renderHook(({ orders }) => useRefusedOrdersRead(orders), { initialProps: { orders: a } });
  act(() => subject(a).next([row]));
  expect(result.current).toEqual({ rows: [row], readError: false });
  act(() => subject(a).error(new Error('storage fault')));
  expect(result.current).toEqual({ rows: [], readError: true });
  rerender({ orders: b });
  expect(result.current.readError).toBe(true);
  act(() => subject(b).next([row]));
  expect(result.current).toEqual({ rows: [row], readError: false });
});

test('RejectedOrdersPanel: a failed read shows v2’s bad notice with both strings, not the list', () => {
  const a = collection();
  render(panel(a));
  act(() => subject(a).next([row]));
  expect(screen.getByTestId('db-rejected')).not.toBeNull();
  expect(screen.queryByTestId('db-rejected-read-error')).toBeNull();
  act(() => subject(a).error(new Error('storage fault')));
  const notice = screen.getByTestId('db-rejected-read-error');
  expect(screen.getByText(TITLE)).not.toBeNull();
  expect(screen.getByText(BODY)).not.toBeNull();
  expect(notice.textContent).toBe(`${TITLE}${BODY}`);
  expect(screen.queryByTestId('db-rejected')).toBeNull();
});

test('RejectedOrdersPanel: no error and no rows renders nothing', () => {
  const a = collection();
  const { container } = render(panel(a));
  act(() => subject(a).next([]));
  expect(screen.queryByTestId('db-rejected')).toBeNull();
  expect(screen.queryByTestId('db-rejected-read-error')).toBeNull();
  expect(container.textContent).toBe('');
});
