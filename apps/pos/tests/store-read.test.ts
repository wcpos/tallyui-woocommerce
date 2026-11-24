import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { StoreOrder } from '@tallyui/core';
import type { StoreOrdersInRange } from '@tallyui/pos';
import type { Session } from '../lib/auth/session';
import { storeRoom, useReportContext } from '../lib/reports/store-read';

afterEach(cleanup);

const storeBase: Omit<StoreOrder, 'id' | 'status' | 'placedAt' | 'totalMinor'> = {
  reference: 'store-order', pricesIncludeTax: false, customer: null, lines: [], fees: [], shipping: [],
  coupons: [], taxLines: [], discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, payments: [], refunds: [], currency: 'USD',
};

test('a complete read with nothing unreadable gives the merged room orders', () => {
  const read: StoreOrdersInRange = {
    orders: [{ ...storeBase, id: 'S', clientOrderId: 'L', status: 'completed', totalMinor: 1000, placedAt: '2026-10-06T13:00:00Z' }],
    progress: null, unreadable: 0, error: null, complete: true,
  };
  const room = storeRoom(read, []);
  expect(room.line).toBeNull();
  expect(room.orders).toHaveLength(1);
  expect(room.orders![0]).toMatchObject({ key: 'L', totalMinor: 1000 });
});

test('a read in progress gives the progress line and no orders', () => {
  expect(storeRoom({ orders: [], progress: { downloaded: 3, total: 10 }, unreadable: 0, error: null, complete: false }, [])).toEqual({
    orders: null, line: 'Reading store orders 3 of 10',
  });
  expect(storeRoom({ orders: [], progress: { downloaded: 0, total: null }, unreadable: 0, error: null, complete: false }, [])).toEqual({
    orders: null, line: 'Reading store orders 0',
  });
});

test('an error, an unreadable order or an idle read gives the till line', () => {
  const reads: StoreOrdersInRange[] = [
    { orders: [], progress: null, unreadable: 0, error: new Error('x'), complete: false },
    { orders: [], progress: null, unreadable: 1, error: null, complete: true },
    { orders: [], progress: null, unreadable: 0, error: null, complete: false },
  ];
  for (const read of reads) {
    expect(storeRoom(read, [])).toEqual({ orders: null, line: "Store unreachable: this till's sales only" });
  }
});

test('useReportContext keeps one object across renders and reads the latest token', () => {
  const connector = { id: 'woo', auth: { getHeaders: ({ token }: { token: string }) => ({ Authorization: 'Bearer ' + token }) } } as never;
  const url = 'https://shop.example/wp-json/wcpos/v2';
  const session = { site: { wcposApiUrl: url }, tokens: { accessToken: 'one' } } as never;
  const { result, rerender } = renderHook(({ session }: { session: Session | null }) => useReportContext(connector, session), {
    initialProps: { session } as { session: Session | null },
  });
  const first = result.current;
  rerender({ session: { site: { wcposApiUrl: url }, tokens: { accessToken: 'two' } } as never });
  expect(result.current).toBe(first);
  expect(result.current!.headers).toEqual({ Authorization: 'Bearer two' });
  expect(result.current!.baseUrl).toBe(url);
  rerender({ session: null });
  expect(result.current).toBeNull();
});
