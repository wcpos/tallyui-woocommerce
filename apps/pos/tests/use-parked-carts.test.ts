import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCart, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { useParkedCarts } from '../lib/sale/use-parked-carts';

addRxPlugin(RxDBMigrationSchemaPlugin);
const a: ParkedCart = { id: 'a', parkedAt: '2026-11-15T10:00:00.000Z', lines: [], orderDiscounts: [], itemCount: 0, totalMinor: 0 };
const b: ParkedCart = { id: 'b', parkedAt: '2026-11-15T11:00:00.000Z', lines: [], orderDiscounts: [], itemCount: 0, totalMinor: 0 };
const c: ParkedCart = { id: 'c', parkedAt: '2026-11-15T12:00:00.000Z', lines: [], orderDiscounts: [], itemCount: 0, totalMinor: 0 };
let db: RxDatabase;
let collection: ParkedCartCollection;

beforeEach(async () => {
  db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  const { parked_carts } = await db.addCollections({
    parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
  });
  collection = parked_carts;
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.remove();
});

test('parks, swaps and discards carts without a collection', async () => {
  const { result } = renderHook(() => useParkedCarts());
  await act(() => result.current.park(a));
  await act(() => result.current.park(b));
  expect(result.current.parked.map(cart => cart.id)).toEqual(['b', 'a']);
  await act(() => result.current.swap(a.id, c));
  expect(result.current.parked.map(cart => cart.id)).toEqual(['c', 'b']);
  await act(() => result.current.swap(c.id));
  expect(result.current.parked.map(cart => cart.id)).toEqual(['b']);
  await act(() => result.current.discard(b.id));
  expect(result.current.parked).toEqual([]);
});

test('follows collection order and persists swaps and discards', async () => {
  const { result } = renderHook(() => useParkedCarts(collection));
  await act(() => result.current.park(b));
  await act(() => result.current.park(a));
  await waitFor(() => expect(result.current.parked.map(cart => cart.id)).toEqual(['b', 'a']));
  expect((await collection.find().exec()).map(doc => doc.id).sort()).toEqual(['a', 'b']);
  await act(() => result.current.swap(a.id, c));
  await waitFor(() => expect(result.current.parked.map(cart => cart.id)).toEqual(['c', 'b']));
  expect((await collection.find().exec()).map(doc => doc.id).sort()).toEqual(['b', 'c']);
  await act(() => result.current.discard(b.id));
  await waitFor(() => expect(result.current.parked.map(cart => cart.id)).toEqual(['c']));
  expect((await collection.find().exec()).map(doc => doc.id)).toEqual(['c']);
});

test('rejects failed inserts without removing the cart being swapped', async () => {
  const { result } = renderHook(() => useParkedCarts(collection));
  await act(() => result.current.park(a));
  await waitFor(() => expect(result.current.parked.map(cart => cart.id)).toEqual(['a']));
  vi.spyOn(collection, 'insert').mockRejectedValue(new Error('disk full'));
  await expect(result.current.park(b)).rejects.toThrow('disk full');
  await expect(result.current.swap(a.id, c)).rejects.toThrow('disk full');
  expect((await collection.find().exec()).map(doc => doc.id)).toEqual(['a']);
  expect(result.current.parked.map(cart => cart.id)).toEqual(['a']);
});

test('allows collection writes after unmount', async () => {
  const { unmount } = renderHook(() => useParkedCarts(collection));
  unmount();
  await collection.insert(a);
});
