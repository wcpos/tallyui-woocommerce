import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readReceiptPrints, RECEIPT_PRINTS_KEPT, RECEIPT_PRINTS_KEY, recordReceiptPrint } from '../lib/receipts/receipt-prints';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';
import { memoryStorage } from './memory-storage';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const printed = () => act(() => { window.dispatchEvent(new Event('afterprint')); });

function Probe({ orderId, testID, hook = useReceiptPrintCount }: { orderId: string; testID: string; hook?: typeof useReceiptPrintCount }) {
  return <span data-testid={testID}>{hook(orderId)}</span>;
}

const throwing = (): Storage => ({
  ...memoryStorage(),
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
});

test('a print adds one to its own order', () => {
  expect(recordReceiptPrint('a')).toBe(1);
  expect(recordReceiptPrint('a')).toBe(2);
  expect(readReceiptPrints('a')).toBe(2);
  expect(readReceiptPrints('b')).toBe(0);
});

test('the count survives a reload', async () => {
  recordReceiptPrint('reload');
  recordReceiptPrint('reload');
  vi.resetModules();
  const prints = await import('../lib/receipts/receipt-prints');
  const { useReceiptPrintCount: freshHook } = await import('../lib/receipts/use-receipt-print-count');
  expect(prints.readReceiptPrints('reload')).toBe(2);
  render(<Probe orderId="reload" testID="count" hook={freshHook} />);
  expect(screen.getByTestId('count').textContent).toBe('2');
  printed();
  expect(screen.getByTestId('count').textContent).toBe('3');
  expect(JSON.parse(localStorage.getItem(RECEIPT_PRINTS_KEY)!)).toEqual({ reload: 3 });
});

test('one print counts once, however many receipts of the order listen', () => {
  render(<>
    <Probe orderId="same" testID="one" />
    <Probe orderId="same" testID="two" />
    <Probe orderId="same" testID="three" />
    <Probe orderId="other" testID="other" />
  </>);
  printed();
  for (const id of ['one', 'two', 'three']) expect(screen.getByTestId(id).textContent).toBe('1');
  expect(readReceiptPrints('same')).toBe(1);
  expect(screen.getByTestId('other').textContent).toBe('1');
  expect(readReceiptPrints('other')).toBe(1);
  printed();
  for (const id of ['one', 'two', 'three']) expect(screen.getByTestId(id).textContent).toBe('2');
});

test('stored data that is not a count reads as 0, and the next print writes 1', () => {
  for (const raw of ['not json', '[1,2]', '{"a":-1}', '{"a":1.5}', '{"a":"2"}', 'null', '3']) {
    localStorage.setItem(RECEIPT_PRINTS_KEY, raw);
    expect(readReceiptPrints('a')).toBe(0);
    expect(recordReceiptPrint('a')).toBe(1);
    expect(JSON.parse(localStorage.getItem(RECEIPT_PRINTS_KEY)!).a).toBe(1);
  }
});

test('a storage that throws still counts for the page and never throws', () => {
  const bad = throwing();
  expect(recordReceiptPrint('blocked', bad)).toBe(1);
  expect(recordReceiptPrint('blocked', bad)).toBe(2);
  expect(readReceiptPrints('blocked', bad)).toBe(2);
});

test('the hook still counts a print when localStorage access throws', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
  try {
    render(<Probe orderId="no-storage" testID="count" />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    printed();
    expect(screen.getByTestId('count').textContent).toBe('1');
  } finally {
    cleanup();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
  }
});

test('only the most recently printed orders are kept', () => {
  for (let i = 0; i <= RECEIPT_PRINTS_KEPT; i++) recordReceiptPrint(`order-${i}`);
  expect(readReceiptPrints('order-0')).toBe(0);
  expect(readReceiptPrints(`order-${RECEIPT_PRINTS_KEPT}`)).toBe(1);
  expect(Object.keys(JSON.parse(localStorage.getItem(RECEIPT_PRINTS_KEY)!))).toHaveLength(RECEIPT_PRINTS_KEPT);
  // order-1 is now the oldest; printing it again moves it to the end, so order-2 is trimmed next instead.
  expect(recordReceiptPrint('order-1')).toBe(2);
  recordReceiptPrint('order-new');
  expect(readReceiptPrints('order-1')).toBe(2);
  expect(readReceiptPrints('order-2')).toBe(0);
  expect(readReceiptPrints('order-new')).toBe(1);
});
