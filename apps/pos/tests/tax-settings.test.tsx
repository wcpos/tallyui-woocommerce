import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { TaxSettings, shippingTaxClassLabel, wooTaxSettingsUrl } from '../components/settings/tax-settings';
import { GeneralSettings } from '../components/settings/general-settings';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const settings = { pricesIncludeTax: true, taxRoundAtSubtotal: false, shippingTaxClass: 'inherit' };
const siteHome = 'https://shop.example/';
const store = { id: 1, name: 'Corner Café', currency: 'AUD', locale: 'en_AU' };

test('Tax shows the calculation rows read-only, each set in WooCommerce', () => {
  const { container } = render(<TaxSettings settings={settings} siteHome={siteHome} />);
  expect(screen.getByTestId('screen-settings-tax')).not.toBeNull();
  expect(screen.getByTestId('settings-tax-calculation')).not.toBeNull();
  expect(screen.getByText('Tax')).not.toBeNull();
  expect(screen.getByText('Calculation')).not.toBeNull();
  expect(screen.getByText('Prices entered with tax')).not.toBeNull();
  expect(screen.getByText('Shipping tax class')).not.toBeNull();
  expect(screen.getByText('Round tax at subtotal level')).not.toBeNull();
  expect(screen.getAllByText('Set in WooCommerce')).toHaveLength(3);
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('settings-tax-locked-tax_round_at_subtotal-switch').getAttribute('aria-checked')).toBe('false');
  expect(screen.getByTestId('settings-tax-locked-tax_round_at_subtotal-switch').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getAllByRole('switch')).toHaveLength(2);
  expect(screen.getByTestId('settings-tax-locked-shipping_tax_class-value').textContent).toBe('Based on cart items');
  expect(container.querySelectorAll('input, textarea, select').length).toBe(0);
  expect(screen.queryByText('Enable taxes')).toBeNull();
  expect(screen.queryByText('View all tax rates')).toBeNull();
});

test('a locked switch does not change when pressed', () => {
  render(<TaxSettings settings={settings} siteHome={siteHome} />);
  fireEvent.click(screen.getByTestId('settings-tax-locked-prices_include_tax-switch'));
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-checked')).toBe('true');
});

test.each([
  ['inherit', 'Based on cart items'],
  ['', 'Standard rate'],
  ['standard', 'Standard rate'],
  ['reduced-rate', 'Reduced rate'],
  ['zero-rate', 'Zero rate'],
])('the shipping tax class %j reads %s', (value, label) => {
  expect(shippingTaxClassLabel(value)).toBe(label);
  render(<TaxSettings settings={{ ...settings, shippingTaxClass: value }} siteHome={siteHome} />);
  expect(screen.getByTestId('settings-tax-locked-shipping_tax_class-value').textContent).toBe(label);
});

test('a store that sends no shipping tax class or rounding shows a dash and an off switch', () => {
  render(<TaxSettings settings={{ pricesIncludeTax: false }} siteHome={siteHome} />);
  expect(screen.getByTestId('settings-tax-locked-shipping_tax_class-value').textContent).toBe('—');
  expect(screen.getByTestId('settings-tax-locked-tax_round_at_subtotal-switch').getAttribute('aria-checked')).toBe('false');
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-checked')).toBe('false');
  expect(shippingTaxClassLabel(undefined)).toBeUndefined();
});

test('Open opens the WooCommerce tax settings tab', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<TaxSettings settings={settings} siteHome={siteHome} />);
  fireEvent.click(screen.getByTestId('settings-tax-locked-shipping_tax_class-open'));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://shop.example/wp-admin/admin.php?page=wc-settings&tab=tax');
  expect(wooTaxSettingsUrl('https://shop.example')).toBe('https://shop.example/wp-admin/admin.php?page=wc-settings&tab=tax');
});

test('General still shows its values as text, not switches', () => {
  render(<GeneralSettings store={store} siteHome={siteHome} />);
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
  expect(screen.getByTestId('settings-general-locked-currency-value').textContent).toBe('AUD');
});
