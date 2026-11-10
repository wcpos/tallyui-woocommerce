import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useMinuteClock } from '../lib/reports/use-minute-clock';

afterEach(() => { cleanup(); vi.useRealTimers(); });

test('the clock reads again once a minute', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  const { result } = renderHook(() => useMinuteClock());
  expect(result.current.getTime()).toBe(new Date(2026, 9, 6, 14, 30).getTime());
  act(() => { vi.advanceTimersByTime(59_999); });
  expect(result.current.getTime()).toBe(new Date(2026, 9, 6, 14, 30).getTime());
  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current.getTime()).toBe(new Date(2026, 9, 6, 14, 31).getTime());
});

test('the clock stops when unmounted', () => {
  vi.useFakeTimers();
  const { unmount } = renderHook(() => useMinuteClock());
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
