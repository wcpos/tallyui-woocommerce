import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StoreSettings } from '@tallyui/core';
import type { StoreSettingsState } from '@tallyui/pos';
import { StoreSettingsGate } from '../components/store-settings-gate';
import { noTaxSettings } from './fixtures/store-settings';

afterEach(cleanup);

const settings = (currency: string, decimals?: number): StoreSettings =>
  ({ ...noTaxSettings, currency, moneyFormat: decimals === undefined ? {} : { decimals } });
const ready = (s: StoreSettings, extra: { refresh?: () => void; refreshing?: boolean } = {}): StoreSettingsState =>
  ({ state: 'ready', settings: s, refresh: extra.refresh ?? (() => {}), refreshing: extra.refreshing });
const gate = (store: StoreSettingsState) =>
  <StoreSettingsGate store={store}>{() => <span>Selling</span>}</StoreSettingsGate>;

test('a USD store at 0 decimals is blocked with the setting to change, and Check again refreshes', () => {
  const refresh = vi.fn();
  render(gate(ready(settings('USD', 0), { refresh })));
  expect(screen.getByTestId('store-decimals-block')).toBeTruthy();
  expect(screen.getByText("This store rounds prices to 0 decimals, but USD needs 2. The till can't sell until the store matches.")).toBeTruthy();
  expect(screen.getByText('In WooCommerce, go to Settings › General › Currency options and set Number of decimals to 2.')).toBeTruthy();
  expect(screen.queryByText('Selling')).toBeNull();
  fireEvent.click(screen.getByText('Check again'));
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('while a refresh runs the button reads Checking… and is disabled', () => {
  const refresh = vi.fn();
  render(gate(ready(settings('USD', 0), { refresh, refreshing: true })));
  const button = screen.getByTestId('store-decimals-check-again');
  expect(button.textContent).toBe('Checking…');
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(refresh).not.toHaveBeenCalled();
});

test.each([['USD at 2', settings('USD', 2)], ['JPY at 0', settings('JPY', 0)], ['USD with no decimals', settings('USD')]])(
  '%s sells', (_name, s) => {
    render(gate(ready(s)));
    expect(screen.getByText('Selling')).toBeTruthy();
    expect(screen.queryByTestId('store-decimals-block')).toBeNull();
  },
);

test('a USD store at 3 decimals is blocked too', () => {
  render(gate(ready(settings('USD', 3))));
  expect(screen.getByText("This store rounds prices to 3 decimals, but USD needs 2. The till can't sell until the store matches.")).toBeTruthy();
  expect(screen.queryByText('Selling')).toBeNull();
});

test('a refresh that brings the store to 2 decimals lifts the block', () => {
  const view = render(gate(ready(settings('USD', 0))));
  expect(screen.getByTestId('store-decimals-block')).toBeTruthy();
  view.rerender(gate(ready(settings('USD', 2))));
  expect(screen.getByText('Selling')).toBeTruthy();
  expect(screen.queryByTestId('store-decimals-block')).toBeNull();
});
