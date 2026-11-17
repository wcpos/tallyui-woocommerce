import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { CashierSheet } from '../components/cashier-sheet';
import { tillAgeLabel, tillSinceTime } from '../lib/cashier/sheet-figures';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 17, 10, 35));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openSheet(extra: Partial<Parameters<typeof CashierSheet>[0]> = {}) {
  render(<><CashierSheet name="Paul" cashiers={[]} onSwitch={() => {}} onAddAnother={() => {}}
    onSignOut={() => {}} storeName="Shop" {...extra} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
}

test('tillSinceTime is device-local, zero-padded HH:mm', () => {
  expect(tillSinceTime(new Date(2026, 10, 17, 9, 5).getTime())).toBe('09:05');
});

test.each([
  [-60000, '0 m'],
  [59 * 60000 + 59000, '59 m'],
  [60 * 60000, '1 h 0 m'],
  [125 * 60000, '2 h 5 m'],
])('tillAgeLabel for %i ms elapsed is %s', (elapsed, label) => {
  const now = Date.now();
  expect(tillAgeLabel(now - elapsed, now)).toBe(label);
});

test('the description shows the store, till time and age', () => {
  const signedInAt = Date.now() - 90 * 60000;
  openSheet({ signedInAt });
  expect(screen.getByTestId('user-sheet-description').textContent)
    .toBe(`Shop · since ${tillSinceTime(signedInAt)} · 1 h 30 m`);
});

test('a saved session without a till time shows only the store', () => {
  openSheet();
  expect(screen.getByTestId('user-sheet-description').textContent).toBe('Shop');
});

test.each([[2, '2 sales'], [1, '1 sale']])('the notice shows %i awaiting the store', (awaitingStore, label) => {
  openSheet({ awaitingStore });
  expect(screen.getByTestId('user-sheet-awaiting-store-title').textContent).toBe(`Awaiting store · ${label}`);
  expect(screen.getByTestId('user-sheet-awaiting-store').getAttribute('role')).toBe('alert');
  expect(screen.getByText('Sent when you are signed in online.')).not.toBeNull();
});

test.each([0, undefined])('no awaiting-store notice appears for %s pending sales', awaitingStore => {
  openSheet({ awaitingStore });
  expect(screen.queryByTestId('user-sheet-awaiting-store')).toBeNull();
});
