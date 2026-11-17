import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useCheckoutBack } from '../lib/sale/use-checkout-back';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

test('Escape on the document calls back and marks the event handled', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back));
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(back).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test('another key does not call back', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(back).not.toHaveBeenCalled();
});

test('Escape in an input, a textarea or a contenteditable does not call back', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back));
  const input = document.createElement('input');
  const textarea = document.createElement('textarea');
  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  const span = document.createElement('span');
  editable.append(span);
  document.body.append(input, textarea, editable);
  for (const target of [input, textarea, span]) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }
  expect(back).not.toHaveBeenCalled();
});

test('Escape while a dialog is open does not call back', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back));
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.append(dialog);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(back).not.toHaveBeenCalled();
});

test('an Escape already handled does not call back', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back));
  document.body.addEventListener('keydown', event => event.preventDefault(), { once: true });
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(back).not.toHaveBeenCalled();
});

test('a disabled hook does not call back', () => {
  const back = vi.fn();
  renderHook(() => useCheckoutBack(back, { enabled: false }));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(back).not.toHaveBeenCalled();
});

test('an unmounted hook does not call back', () => {
  const back = vi.fn();
  const { unmount } = renderHook(() => useCheckoutBack(back));
  unmount();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(back).not.toHaveBeenCalled();
});
