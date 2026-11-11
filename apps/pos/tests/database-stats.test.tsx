import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DatabaseStats } from '../components/database-stats';
import { formatBytes, isReadyToSell, totalLocalRecords } from '../lib/health/database-stats';
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
