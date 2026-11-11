import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { GeneralSettings, countryLabel } from '../components/settings/general-settings';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const siteHome = 'https://shop.example/';
const store = { id: 1, name: 'Corner Café', currency: 'USD', locale: 'en_US' };
const value = (id: string) => screen.getByTestId(`settings-general-locked-${id}-value`).textContent;

test('the Store group reads the base address after the store name', () => {
  render(<GeneralSettings siteHome={siteHome}
    store={{ ...store, address: { country: 'US', state: 'AL', city: 'Birmingham', postcode: '12345' } }} />);
  expect(value('store_country')).toBe('United States (US)');
  expect(value('store_state')).toBe('AL');
  expect(value('store_city')).toBe('Birmingham');
  expect(value('store_postcode')).toBe('12345');
  const group = within(screen.getByTestId('settings-general-store'));
  expect(group.getAllByText(/^Store (Name|Base (Country|State|City|Postcode))$/).map(node => node.textContent)).toEqual([
    'Store Name', 'Store Base Country', 'Store Base State', 'Store Base City', 'Store Base Postcode',
  ]);
});

test('a store with no address reads a dash on each base-address row', () => {
  render(<GeneralSettings store={store} siteHome={siteHome} />);
  for (const id of ['store_country', 'store_state', 'store_city', 'store_postcode']) expect(value(id)).toBe('—');
});

test('Language sits under Localization and Currency under Currency & numbers', () => {
  render(<GeneralSettings store={store} siteHome={siteHome} />);
  const store_ = screen.getByTestId('settings-general-store');
  const localization = screen.getByTestId('settings-general-localization');
  const currency = screen.getByTestId('settings-general-currency');
  expect(within(localization).getByText('Localization')).not.toBeNull();
  expect(within(localization).getByTestId('settings-general-locked-locale-value').textContent).toBe('en_US');
  expect(within(currency).getByText('Currency & numbers')).not.toBeNull();
  expect(within(currency).getByTestId('settings-general-locked-currency-value').textContent).toBe('USD');
  expect(within(store_).queryByTestId('settings-general-locked-locale')).toBeNull();
  expect(within(store_).queryByTestId('settings-general-locked-currency')).toBeNull();
});

test('countryLabel names the region, and falls back for a code Intl cannot name', () => {
  expect(countryLabel('US')).toBe('United States (US)');
  expect(countryLabel('GB')).toBe('United Kingdom (GB)');
  expect(countryLabel(undefined)).toBeUndefined();
  // Intl answers "Unknown Region" for an unassigned code, and throws on a malformed one.
  expect(countryLabel('ZZ')).toBe('Unknown Region (ZZ)');
  expect(countryLabel('not a code')).toBe('not a code');
});
