import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { Text } from '@tallyui/components';
import { SettingsArea } from '../components/settings/settings-area';
import { SETTINGS_DEFAULT_HREF, SETTINGS_NAV_ITEMS } from '../components/settings/settings-navigation';
import { GeneralSettings, wooSettingsUrl } from '../components/settings/general-settings';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const store = { id: 1, name: 'Corner Café', currency: 'AUD', locale: 'en_AU' };
const siteHome = 'https://shop.example/';

test('the nav lists General, Tax, Barcode Scanning then Theme, with the v2 test ids and hrefs', () => {
  expect(SETTINGS_NAV_ITEMS).toEqual([{ href: '/settings/general', label: 'General', testID: 'settings-nav-general' }, { href: '/settings/tax', label: 'Tax', testID: 'settings-nav-tax' }, { href: '/settings/barcode-scanning', label: 'Barcode Scanning', testID: 'settings-nav-barcode-scanning' }, { href: '/settings/theme', label: 'Theme', testID: 'settings-nav-theme' }]);
  expect(SETTINGS_DEFAULT_HREF).toBe('/settings/general');
  render(
    <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref="/settings/general" onNavigate={vi.fn()} onBack={vi.fn()}>
      <Text>page body</Text>
    </SettingsArea>
  );
  expect(screen.getByTestId('settings-nav-general')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-tax')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-barcode-scanning')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-theme')).not.toBeNull();
  expect(within(screen.getByTestId('settings-screen')).getByText('page body')).not.toBeNull();
  expect(screen.getByTestId('settings-navigation')).not.toBeNull();
});

test('pressing a nav item navigates to its href', () => {
  const onNavigate = vi.fn();
  render(
    <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref="/settings/general" onNavigate={onNavigate} onBack={vi.fn()}>
      <Text>page body</Text>
    </SettingsArea>
  );
  fireEvent.click(screen.getByTestId('settings-nav-general'));
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/settings/general');
});

test('Back calls onBack', () => {
  const onBack = vi.fn();
  render(
    <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref="/settings/general" onNavigate={vi.fn()} onBack={onBack}>
      <Text>page body</Text>
    </SettingsArea>
  );
  fireEvent.click(screen.getByTestId('settings-back'));
  expect(onBack).toHaveBeenCalledOnce();
  expect(screen.getByText('Settings')).not.toBeNull();
});

test('General shows the store name, currency and language read-only, each set in WooCommerce', () => {
  const { container } = render(<GeneralSettings store={store} siteHome={siteHome} />);
  expect(screen.getByTestId('screen-settings-general')).not.toBeNull();
  expect(screen.getByText('General')).not.toBeNull();
  expect(screen.getByText('Store')).not.toBeNull();
  expect(screen.getByTestId('settings-general-locked-name-value').textContent).toBe('Corner Café');
  expect(screen.getByTestId('settings-general-locked-currency-value').textContent).toBe('AUD');
  expect(screen.getByTestId('settings-general-locked-locale-value').textContent).toBe('en_AU');
  expect(screen.getAllByText('Set in WooCommerce')).toHaveLength(3);
  expect(screen.getByText('Store Name')).not.toBeNull();
  expect(screen.getByText('Currency')).not.toBeNull();
  expect(screen.getByText('Language')).not.toBeNull();
  expect(container.querySelectorAll('input, textarea, select').length).toBe(0);
});

test('a missing language shows a dash', () => {
  render(<GeneralSettings store={{ ...store, locale: undefined }} siteHome={siteHome} />);
  expect(screen.getByTestId('settings-general-locked-locale-value').textContent).toBe('—');
});

test('Open opens the WooCommerce settings page', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<GeneralSettings store={store} siteHome={siteHome} />);
  fireEvent.click(screen.getByTestId('settings-general-locked-currency-open'));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://shop.example/wp-admin/admin.php?page=wc-settings');
  expect(wooSettingsUrl('https://shop.example')).toBe('https://shop.example/wp-admin/admin.php?page=wc-settings');
});
