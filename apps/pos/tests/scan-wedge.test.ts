import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWedgeDetector, DEFAULT_SCAN_SETTINGS } from '../lib/scan/wedge';
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

test('a configured threshold accepts a burst the default refuses', () => {
  const onScan = vi.fn();
  const fallback = createWedgeDetector(onScan);
  for (const key of code) { fallback.key(key); vi.advanceTimersByTime(30); }
  expect(fallback.key('Enter')).toBe(false);
  const configured = createWedgeDetector(onScan, { getSettings: () => ({ ...DEFAULT_SCAN_SETTINGS, threshold: 40 }) });
  for (const key of code) { configured.key(key); vi.advanceTimersByTime(30); }
  expect(configured.key('Enter')).toBe(true);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
});

test('a configured minimum length accepts a four-digit code', () => {
  const onScan = vi.fn();
  const detector = createWedgeDetector(onScan, { getSettings: () => ({ ...DEFAULT_SCAN_SETTINGS, minChars: 4 }) });
  for (const key of '1234') { detector.key(key); vi.advanceTimersByTime(5); }
  expect(detector.key('Enter')).toBe(true);
  expect(onScan).toHaveBeenCalledExactlyOnceWith('1234');
});

test('the prefix and suffix come off before the length check', () => {
  const onScan = vi.fn();
  const settings = { ...DEFAULT_SCAN_SETTINGS, prefix: ']C1', suffix: '#', minChars: 13 };
  const detector = createWedgeDetector(onScan, { getSettings: () => settings });
  for (const key of `]C1${code}#`) { detector.key(key); vi.advanceTimersByTime(5); }
  expect(detector.key('Enter')).toBe(true);
  expect(onScan).toHaveBeenCalledExactlyOnceWith(code);
  settings.minChars = 14;
  for (const key of `]C1${code}#`) { detector.key(key); vi.advanceTimersByTime(5); }
  expect(detector.key('Enter')).toBe(false);
  expect(onScan).toHaveBeenCalledOnce();
});

test('onAttempt reports scan, too short and typing', () => {
  const onAttempt = vi.fn();
  const detector = createWedgeDetector(vi.fn(), { onAttempt });
  for (const key of code) { detector.key(key); vi.advanceTimersByTime(5); }
  detector.key('Enter');
  for (const key of '123') { detector.key(key); vi.advanceTimersByTime(5); }
  detector.key('Enter');
  for (const key of '123') { detector.key(key); vi.advanceTimersByTime(100); }
  detector.key('Enter');
  detector.key('7');
  vi.advanceTimersByTime(150);
  expect(onAttempt.mock.calls.map(([attempt]) => attempt)).toEqual([
    { raw: code, code, avgGapMs: 5, result: 'scan' },
    { raw: '123', code: '123', avgGapMs: 5, result: 'too_short' },
    { raw: '123', code: '123', avgGapMs: 100, result: 'typing' },
    { raw: '7', code: '7', avgGapMs: undefined, result: 'typing' },
  ]);
});

test('the scanner claimed last owns the wedge until it is released', () => {
  const till = vi.fn();
  const over = vi.fn();
  renderHook(() => useWedgeScanner(till, true));
  const top = renderHook(() => useWedgeScanner(over, true));
  for (const key of [...code, 'Enter']) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  expect(over).toHaveBeenCalledExactlyOnceWith(code);
  expect(till).not.toHaveBeenCalled();
  top.unmount();
  for (const key of [...code, 'Enter']) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(5);
  }
  expect(till).toHaveBeenCalledExactlyOnceWith(code);
  expect(over).toHaveBeenCalledOnce();
});
