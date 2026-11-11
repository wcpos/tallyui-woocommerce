// The Tax settings route's wiring: the basis and Enable Taxes come from the catalogue's store.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import TaxSettingsRoute from '../app/settings/tax';
import { noTaxSettings } from './fixtures/store-settings';

const mocks = vi.hoisted(() => ({
  catalogueState: {} as { catalogue: null | { store: Record<string, unknown> } },
}));

vi.mock('expo-router', () => ({
  Redirect: () => <span data-testid="redirect" />,
}));

vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({
    session: {
      site: {
        name: 'Store', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
        wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/',
      },
      tokens: {
        accessToken: 'access', refreshToken: 'refresh', expiresAt: Math.floor(Date.now() / 1000) + 86400,
        user: { id: 2, uuid: '12345678-1234-1234-1234-123456789abc', displayName: 'Cashier' },
      },
    },
    ready: true,
  }),
}));

vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ error: undefined, ...mocks.catalogueState }),
}));

vi.mock('../lib/sale/use-till-store-settings', async () => {
  const { noTaxSettings: settings } = await import('./fixtures/store-settings');
  return { useTillStoreSettings: () => ({ state: 'ready', settings }) };
});

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('the route passes the catalogue store, so the basis and Enable Taxes read from it', () => {
  mocks.catalogueState = {
    catalogue: { store: { id: 1, name: 'Store', currency: noTaxSettings.currency, taxBasedOn: 'base', calcTaxes: true } },
  };
  render(<TaxSettingsRoute />);
  expect(screen.getByTestId('settings-tax-locked-tax_based_on-value').textContent).toBe('Shop base address');
  expect(screen.getByTestId('settings-tax-locked-calc_taxes-switch').getAttribute('aria-checked')).toBe('true');
});

test('before the catalogue is up, the basis reads the dash and the rest of the page still renders', () => {
  mocks.catalogueState = { catalogue: null };
  render(<TaxSettingsRoute />);
  expect(screen.getByTestId('settings-tax-locked-tax_based_on-value').textContent).toBe('—');
  expect(screen.getByTestId('settings-tax-locked-calc_taxes-value').textContent).toBe('—');
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch')).not.toBeNull();
});
