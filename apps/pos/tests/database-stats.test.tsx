import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { DatabaseStats } from '../components/database-stats';
import { estimateCollectionBytes, estimateCollectionSize, formatBytes, isReadyToSell, totalLocalRecords } from '../lib/health/database-stats';
import { useStorageEstimate } from '../lib/health/use-storage-estimate';

const original = Object.getOwnPropertyDescriptor(navigator, 'storage');
function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { configurable: true, value });
}
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(navigator, 'storage', original);
  else Reflect.deleteProperty(navigator, 'storage');
});

test('ready to sell once a product is local', () => {
  expect(isReadyToSell(0)).toBe(false);
  expect(isReadyToSell(3)).toBe(true);
});

test('total local records sums the counts, a loading count as 0', () => {
  expect(totalLocalRecords({ a: 2, b: null, c: 5 })).toBe(7);
});

test('formatBytes reads as v2 does', () => {
  expect(formatBytes(null)).toBeNull();
  expect(formatBytes(NaN)).toBeNull();
  expect(formatBytes(-1)).toBeNull();
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  expect(formatBytes(9.5 * 1024 ** 3)).toBe('9.5 GB');
});

test('estimateCollectionBytes is v2\'s sample average times the count', () => {
  expect(estimateCollectionBytes(0, [100])).toBeNull();
  expect(estimateCollectionBytes(5, [])).toBeNull();
  expect(estimateCollectionBytes(5, [NaN, 0, -3])).toBeNull();
  expect(estimateCollectionBytes(10, [100, 300])).toBe(2000);
  expect(estimateCollectionBytes(3, [100, NaN, 201])).toBe(452);
});

test('estimateCollectionSize samples at most 25 documents and multiplies by the count', async () => {
  const db = await createRxDatabase({ name: `database_sizes_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  try {
    const schema = { version: 0, primaryKey: 'id', type: 'object', properties: {
      id: { type: 'string', maxLength: 100 }, pad: { type: 'string' },
    }, required: ['id'] };
    const { products: col, empty } = await db.addCollections({ products: { schema }, empty: { schema } });
    await col.bulkInsert(Array.from({ length: 30 }, (_, i) => ({ id: String(i).padStart(2, '0'), pad: 'x'.repeat(50) })));
    const find = vi.spyOn(col, 'find');
    expect(await estimateCollectionSize(col)).toBe(30 * JSON.stringify((await col.findOne().exec())!.toJSON()).length);
    expect(find).toHaveBeenCalledWith({ limit: 25 });
    const emptyFind = vi.spyOn(empty, 'find');
    expect(await estimateCollectionSize(empty)).toBeNull();
    expect(emptyFind).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    await db.close();
  }
});

test('useStorageEstimate returns the usage the estimate resolves', async () => {
  setStorage({ estimate: () => Promise.resolve({ usage: 2048 }) });
  const { result } = renderHook(() => useStorageEstimate());
  await waitFor(() => expect(result.current).toBe(2048));
});

test('useStorageEstimate is null when the estimate rejects', async () => {
  let rejected = false;
  setStorage({ estimate: () => { rejected = true; return Promise.reject(new Error('denied')); } });
  const { result } = renderHook(() => useStorageEstimate());
  await waitFor(() => expect(rejected).toBe(true));
  await Promise.resolve();
  expect(result.current).toBeNull();
});

// react-native-web drops className from the DOM, so read it off the component that took the testID (as logs-screen.test).
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

test('a products count still loading is not ready to sell, and adds nothing to the records', () => {
  render(<DatabaseStats counts={{ products: null, customers: 4 }} storageBytes={null} waiting={0} />);
  expect(screen.getByTestId('db-stat-ready-value').textContent).toBe('Preparing…');
  expect(classesOf('db-stat-ready-value')).not.toContain('text-success');
  expect(screen.getByTestId('db-stat-records-value').textContent).toBe('4');
});

test('useStorageEstimate is null without navigator.storage', () => {
  setStorage(undefined);
  const { result } = renderHook(() => useStorageEstimate());
  expect(result.current).toBeNull();
});

test('v2\'s StatHeader rule: a border under the figures, with its pb-3', () => {
  render(<DatabaseStats counts={{ products: 1 }} storageBytes={null} waiting={0} />);
  expect(classesOf('db-stats')).toEqual(expect.arrayContaining(['border-b', 'border-border', 'pb-3']));
});
