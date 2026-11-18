import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Platform } from 'react-native';
import { useRowKeyboard } from '../lib/orders/use-row-keyboard';

afterEach(() => { cleanup(); });

const ids = ['a', 'b'];
function setup() {
  const open = vi.fn();
  const scroll = vi.fn();
  const hook = renderHook(() => useRowKeyboard(ids, open, scroll));
  const key = (key: string) => {
    const preventDefault = vi.fn();
    act(() => hook.result.current.onKeyDown?.({
      key, target: document.body, preventDefault,
    } as unknown as Parameters<NonNullable<typeof hook.result.current.onKeyDown>>[0]));
    return preventDefault;
  };
  return { ...hook, key, open, scroll };
}

test('moves focus, scrolls and opens on Enter; Escape is not the list key', () => {
  const { key, result, open, scroll } = setup();
  key('ArrowDown');
  expect(result.current.focusIndex).toBe(0);
  key('ArrowDown');
  expect(result.current.focusIndex).toBe(1);
  key('ArrowDown');
  expect(result.current.focusIndex).toBe(1);
  expect(scroll).toHaveBeenLastCalledWith(1);
  key('Enter');
  expect(open).toHaveBeenLastCalledWith('b');
  key('ArrowUp');
  key('Enter');
  expect(open).toHaveBeenLastCalledWith('a');
  key('Escape');
  expect(open).toHaveBeenCalledTimes(2);
});

test('keys other than the arrows and Enter leave the focused row alone', () => {
  const { key, result, scroll } = setup();
  key('ArrowDown');
  key('ArrowDown');
  expect(result.current.focusIndex).toBe(1);
  const scrolls = scroll.mock.calls.length;
  for (const k of ['Escape', 'a', 'Home']) {
    const preventDefault = key(k);
    expect(result.current.focusIndex).toBe(1);
    expect(scroll).toHaveBeenCalledTimes(scrolls);
    expect(preventDefault).not.toHaveBeenCalled();
  }
});

test('rings the row after a keyboard move, never after a click', () => {
  const { key, result } = setup();
  key('ArrowDown');
  expect(result.current.ring).toBe(true);
  // The focus event that follows the hook's own move keeps the ring.
  act(() => result.current.focusFrom(0));
  expect(result.current.ring).toBe(true);
  // A click (its focus event arrives with no key behind it) drops it.
  act(() => result.current.focusFrom(1));
  expect(result.current.focusIndex).toBe(1);
  expect(result.current.ring).toBe(false);
});

test('does nothing on native', () => {
  const old = Platform.OS;
  Platform.OS = 'ios';
  try {
    expect(setup().result.current.onKeyDown).toBeUndefined();
  } finally {
    Platform.OS = old;
  }
});

test('does not intercept a control inside a row', () => {
  const { result, open } = setup();
  act(() => result.current.onKeyDown?.({
    key: 'Enter', target: document.createElement('button'), preventDefault: vi.fn(),
  } as unknown as Parameters<NonNullable<typeof result.current.onKeyDown>>[0]));
  expect(open).not.toHaveBeenCalled();
});
