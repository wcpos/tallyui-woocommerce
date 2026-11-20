import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReceiptCopyLine } from '../components/receipt-identity';
import { formatPrintedAt } from '../lib/receipts/use-receipt-printed-at';

const T1 = new Date('2026-11-20T15:04:00Z');
const T2 = new Date('2026-11-20T15:37:00Z');
// v2's printed datetime shape; recent ICU puts U+202F before PM, so never a literal space there.
const SHAPE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M$/u;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('formats the printed time as v2 does', () => {
  expect(formatPrintedAt(T1, 'UTC')).toMatch(/^Nov 20, 2026, 3:04\sPM$/u);
});

test('a bad time zone falls back to the device zone', () => {
  let text = '';
  expect(() => { text = formatPrintedAt(T1, 'Not/AZone'); }).not.toThrow();
  expect(text).toMatch(SHAPE);
  expect(text).toBe(formatPrintedAt(T1));
});

test('stamps the copy line when it mounts', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T1);
  render(<ReceiptCopyLine count={1} />);
  expect(screen.getByTestId('receipt-copy').textContent).toBe(`COPY 1 · ${formatPrintedAt(T1)}`);
});

test('restamps the copy line before the browser lays out a print', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T1);
  render(<ReceiptCopyLine count={1} />);
  vi.setSystemTime(T2);
  expect(formatPrintedAt(T2)).not.toBe(formatPrintedAt(T1));
  // The dispatch stays outside act: only a synchronous commit (flushSync) shows T2 before the next line reads it.
  const actEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  try {
    window.dispatchEvent(new Event('beforeprint'));
    expect(screen.getByTestId('receipt-copy').textContent).toBe(`COPY 1 · ${formatPrintedAt(T2)}`);
  } finally {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
});

test('stops listening for prints once unmounted', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const remove = vi.spyOn(window, 'removeEventListener');
  const { unmount } = render(<ReceiptCopyLine count={1} />);
  unmount();
  expect(remove).toHaveBeenCalledWith('beforeprint', expect.any(Function));
  expect(() => window.dispatchEvent(new Event('beforeprint'))).not.toThrow();
  expect(error).not.toHaveBeenCalled();
});
