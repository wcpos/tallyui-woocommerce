import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWedgeDetector } from '../lib/scan/wedge';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';

const code = '2000000000015';
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

test('fast digits end with Enter and emit once', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan);
  for (const key of code) { detector.key(key); vi.advanceTimersByTime(5); }
  expect(detector.key('Enter')).toBe(true);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
  vi.advanceTimersByTime(150);
  expect(onScan).toHaveBeenCalledOnce();
});

test('fast digits without a terminator emit after 150 ms', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan);
  for (const key of code) { vi.advanceTimersByTime(5); detector.key(key); }
  vi.advanceTimersByTime(149);
  expect(onScan).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
});

test('slow digits are not a scan', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan);
  for (const key of code) { detector.key(key); vi.advanceTimersByTime(100); }
  expect(detector.key('Enter')).toBe(false);
  expect(onScan).not.toHaveBeenCalled();
});

test('seven fast digits are too short', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan);
  for (const key of code.slice(0, 7)) { detector.key(key); vi.advanceTimersByTime(5); }
  expect(detector.key('Enter')).toBe(false);
  expect(onScan).not.toHaveBeenCalled();
});

test('Shift and ArrowDown between digits leave the code unchanged', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan);
  for (const key of code) {
    detector.key(key);
    expect(detector.key('Shift')).toBe(false);
    expect(detector.key('ArrowDown')).toBe(false);
    vi.advanceTimersByTime(5);
  }
  expect(detector.key('Enter')).toBe(true);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
});

test('the hook accepts a document burst and prevents the terminating Enter', () => {
  const onScan = vi.fn();
  renderHook(() => useWedgeScanner(onScan, true));
  for (const key of code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  document.dispatchEvent(enter);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
  expect(enter.defaultPrevented).toBe(true);
});

test('the hook ignores bursts in an input', () => {
  const onScan = vi.fn();
  renderHook(() => useWedgeScanner(onScan, true));
  const input = document.createElement('input');
  document.body.appendChild(input);
  for (const key of [...code, 'Enter']) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  input.remove();
  vi.advanceTimersByTime(150);
  expect(onScan).not.toHaveBeenCalled();
});

test('the hook ignores bursts while inactive and after unmount', () => {
  const onScan = vi.fn();
  const inactive = renderHook(() => useWedgeScanner(onScan, false));
  for (const key of [...code, 'Enter']) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  expect(onScan).not.toHaveBeenCalled();
  inactive.unmount();
  const active = renderHook(() => useWedgeScanner(onScan, true));
  for (const key of code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  active.unmount();
  vi.advanceTimersByTime(150);
  for (const key of [...code, 'Enter']) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  expect(onScan).not.toHaveBeenCalled();
});

test('the hook ignores bursts with Ctrl held', () => {
  const onScan = vi.fn();
  renderHook(() => useWedgeScanner(onScan, true));
  for (const key of [...code, 'Enter']) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ctrlKey: true }));
    vi.advanceTimersByTime(5);
  }
  vi.advanceTimersByTime(150);
  expect(onScan).not.toHaveBeenCalled();
});
