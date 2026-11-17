import { act, cleanup, render } from '@testing-library/react';
import { callbackSink, type LogEntry } from '@tallyui/pos';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TALLYUI_LOGGERS } from '../lib/logs/log-store';
import { connectivityLogger } from '../lib/online/connectivity-logger';
import { OnlineStatusContext } from '../lib/online/online-status';
import { OnlineStatusLogger } from '../lib/online/online-status-logger';
import { dismissToast, getToasts } from '../lib/toast/toast';

let entries: LogEntry[];
beforeEach(() => {
  vi.useFakeTimers();
  entries = [];
  connectivityLogger.addSink(callbackSink({ id: 'test-connectivity', levels: ['debug', 'info', 'warn', 'error'],
    callback: entry => { entries.push(entry); } }));
});
afterEach(() => {
  connectivityLogger.removeSink('test-connectivity');
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

test('the mounted status announces nothing', () => {
  render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(getToasts()).toHaveLength(0);
  expect(entries).toHaveLength(0);
});

test('going offline toasts and logs after the status holds for 5 s', () => {
  const { rerender } = render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  rerender(<OnlineStatusContext.Provider value={{ status: 'offline' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(4_999); });
  expect(getToasts()).toHaveLength(0);
  expect(entries).toHaveLength(0);
  act(() => { vi.advanceTimersByTime(1); });
  expect(getToasts()).toHaveLength(1);
  expect(getToasts()[0]).toMatchObject({ title: 'Device went offline', type: 'warning' });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ level: 'warn', scope: 'connectivity', message: 'Device went offline',
    data: { code: 'SYNC121' } });
});

test('an unreachable website toasts and logs a warning', () => {
  const { rerender } = render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  rerender(<OnlineStatusContext.Provider value={{ status: 'online-website-unavailable' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(5_000); });
  expect(getToasts()).toHaveLength(1);
  expect(getToasts()[0]).toMatchObject({ title: 'Website is unreachable', type: 'warning' });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ level: 'warn', scope: 'connectivity', message: 'Website is unreachable',
    data: { code: 'SYNC121' } });
});

test('coming back online toasts Connection restored as a success', () => {
  const { rerender } = render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  rerender(<OnlineStatusContext.Provider value={{ status: 'offline' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(5_000); });
  rerender(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(5_000); });
  expect(getToasts()[0]).toMatchObject({ title: 'Connection restored', type: 'success' });
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ level: 'warn', message: 'Device went offline', data: { code: 'SYNC121' } });
  expect(entries[1]).toMatchObject({ level: 'info', message: 'Connection restored', data: { outcome: 'ok' } });
});

test('a change that reverts within 5 s announces nothing', () => {
  const { rerender } = render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  rerender(<OnlineStatusContext.Provider value={{ status: 'offline' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(3_000); });
  rerender(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(getToasts()).toHaveLength(0);
  expect(entries).toHaveLength(0);
});

test('each new change restarts the settle time', () => {
  const { rerender } = render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  rerender(<OnlineStatusContext.Provider value={{ status: 'offline' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(3_000); });
  rerender(<OnlineStatusContext.Provider value={{ status: 'online-website-unavailable' }}><OnlineStatusLogger /></OnlineStatusContext.Provider>);
  act(() => { vi.advanceTimersByTime(3_000); });
  expect(getToasts()).toHaveLength(0);
  expect(entries).toHaveLength(0);
  act(() => { vi.advanceTimersByTime(2_000); });
  expect(getToasts()).toHaveLength(1);
  expect(getToasts()[0]).toMatchObject({ title: 'Website is unreachable', type: 'warning' });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ level: 'warn', message: 'Website is unreachable', data: { code: 'SYNC121' } });
});

test('the Logs store listens to the connectivity logger', () => {
  expect(TALLYUI_LOGGERS).toContain(connectivityLogger);
});
