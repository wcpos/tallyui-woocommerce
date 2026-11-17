import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LocalDataResetGate } from '../components/local-data-reset-gate';
import { LOCAL_DATA_RESET_KEY } from '../lib/local-data-reset';
import { memoryStorage } from './memory-storage';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('with no reset pending the gate renders the app and clears nothing', () => {
  const reset = vi.fn(async () => {});
  const reload = vi.fn();
  render(<LocalDataResetGate reset={reset} reload={reload}><span>App</span></LocalDataResetGate>);
  expect(screen.getByText('App')).not.toBeNull();
  expect(reset).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

test('a pending reset clears before anything renders, then reloads', async () => {
  localStorage.setItem(LOCAL_DATA_RESET_KEY, '1');
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const reset = vi.fn(() => pending);
  const reload = vi.fn();
  const child = vi.fn(() => <span>App</span>);
  const Child = child;
  render(<LocalDataResetGate reset={reset} reload={reload}><Child /></LocalDataResetGate>);
  expect(screen.queryByText('App')).toBeNull();
  expect(child).not.toHaveBeenCalled();
  expect(reset).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  await act(async () => { resolve(); await pending; });
  expect(reload).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('App')).toBeNull();
  expect(child).not.toHaveBeenCalled();
});

test('a reset that fails still reloads', async () => {
  localStorage.setItem(LOCAL_DATA_RESET_KEY, '1');
  const reset = vi.fn().mockRejectedValue(new Error('reset failed'));
  const reload = vi.fn();
  await act(async () => {
    render(<LocalDataResetGate reset={reset} reload={reload}><span>App</span></LocalDataResetGate>);
  });
  expect(reset).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('App')).toBeNull();
});
