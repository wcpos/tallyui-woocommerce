import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { StoreSettings } from '@tallyui/core';
import { TaxSettings, ratePercent, rateTags, shippingTaxClassLabel, wooTaxSettingsUrl } from '../components/settings/tax-settings';
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
  expect(screen.queryByText('Tax')).toBeNull();
  expect(screen.getByText('Calculation')).not.toBeNull();
  expect(screen.getByText('Prices Entered with Tax')).not.toBeNull();
  expect(screen.getByText('Shipping Tax Class')).not.toBeNull();
  expect(screen.getByText('Round Tax at Subtotal Level')).not.toBeNull();
  expect(screen.getAllByText('Set in WooCommerce')).toHaveLength(5);
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-tax-locked-prices_include_tax-switch').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('settings-tax-locked-tax_round_at_subtotal-switch').getAttribute('aria-checked')).toBe('false');
  expect(screen.getByTestId('settings-tax-locked-tax_round_at_subtotal-switch').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getAllByRole('switch')).toHaveLength(2);
  expect(screen.getByTestId('settings-tax-locked-shipping_tax_class-value').textContent).toBe('Based on cart items');
  expect(container.querySelectorAll('input, textarea, select').length).toBe(0);
  // Without the catalogue's store, the basis and Enable Taxes read the dash, not an off switch.
  expect(screen.getByTestId('settings-tax-locked-tax_based_on-value').textContent).toBe('—');
  expect(screen.getByTestId('settings-tax-locked-calc_taxes-value').textContent).toBe('—');
  expect(screen.queryByText('View all tax rates')).toBeNull();
});

test('the Calculation rows read in the demo order and labels', () => {
  render(<TaxSettings settings={settings} store={{ taxBasedOn: 'base', calcTaxes: true }} siteHome={siteHome} />);
  const labels = within(screen.getByTestId('settings-tax-calculation')).getAllByText(
    /^(Calculate tax based on|Enable Taxes|Prices Entered with Tax|Shipping Tax Class|Round Tax at Subtotal Level)$/);
  expect(labels.map(node => node.textContent)).toEqual([
    'Calculate tax based on', 'Enable Taxes', 'Prices Entered with Tax', 'Shipping Tax Class', 'Round Tax at Subtotal Level',
  ]);
});

test.each([
  ['base', 'Shop base address'],
  ['billing', 'Customer billing address'],
  ['shipping', 'Customer shipping address'],
] as const)('tax based on %j reads %s', (taxBasedOn, label) => {
  render(<TaxSettings settings={settings} store={{ taxBasedOn }} siteHome={siteHome} />);
  expect(screen.getByTestId('settings-tax-locked-tax_based_on-value').textContent).toBe(label);
});

test.each([[true, 'true'], [false, 'false']] as const)('Enable Taxes %s is a locked switch', (calcTaxes, checked) => {
  render(<TaxSettings settings={settings} store={{ calcTaxes }} siteHome={siteHome} />);
  const toggle = screen.getByTestId('settings-tax-locked-calc_taxes-switch');
  expect(toggle.getAttribute('aria-checked')).toBe(checked);
  expect(toggle.getAttribute('aria-disabled')).toBe('true');
});

const rate = (fields: Partial<TaxRateRow> & Pick<TaxRateRow, 'id' | 'label' | 'rate'>): TaxRateRow =>
  ({ code: `US-${fields.label}`, priority: 1, compound: false, shipping: true, ...fields });
type TaxRateRow = NonNullable<StoreSettings['taxRates']>[string][number];

test('Tax Rates lists each class with its rates, percents and tags', () => {
  render(<TaxSettings siteHome={siteHome} settings={{ ...settings, taxRates: {
    standard: [rate({ id: 1, label: 'Sales Tax', rate: '10.0000' })],
    'reduced-rate': [rate({ id: 2, label: 'Reduced', rate: '5.0000', compound: true, priority: 2 })],
  } }} />);
  const group = within(screen.getByTestId('settings-tax-rates'));
  expect(group.getByText('Tax Rates')).not.toBeNull();
  const standard = within(screen.getByTestId('settings-tax-rates-class-standard'));
  expect(standard.getByText('Standard rate')).not.toBeNull();
  expect(standard.getByText('Sales Tax')).not.toBeNull();
  expect(screen.getByTestId('settings-tax-rate-1-rate').textContent).toBe('10%');
  expect(within(screen.getByTestId('settings-tax-rate-1')).queryByText(/Compound|Priority|shipping/)).toBeNull();
  const reduced = within(screen.getByTestId('settings-tax-rates-class-reduced-rate'));
  expect(reduced.getByText('Reduced rate')).not.toBeNull();
  expect(screen.getByTestId('settings-tax-rate-2-rate').textContent).toBe('5%');
  expect(within(screen.getByTestId('settings-tax-rate-2')).getByText('Compound · Priority 2')).not.toBeNull();
  expect(screen.getByTestId('settings-tax-rates-note').textContent).toBe("The rates that apply at the store's address.");
  expect(screen.queryByTestId('settings-tax-rates-empty')).toBeNull();
});

test('a rate not charged on shipping says so, and a fractional rate keeps its decimals', () => {
  render(<TaxSettings siteHome={siteHome} settings={{ ...settings, taxRates: {
    standard: [rate({ id: 7, label: 'County', rate: '8.2500', shipping: false })],
  } }} />);
  expect(within(screen.getByTestId('settings-tax-rate-7')).getByText('Not on shipping')).not.toBeNull();
  expect(screen.getByTestId('settings-tax-rate-7-rate').textContent).toBe('8.25%');
});

test('rateTags and ratePercent follow v2', () => {
  expect(rateTags({ compound: true, shipping: false, priority: 3 })).toBe('Compound · Not on shipping · Priority 3');
  expect(rateTags({ compound: false, shipping: true, priority: 1 })).toBe('');
  expect(ratePercent('10.0000')).toBe('10%');
  expect(ratePercent('8.2500')).toBe('8.25%');
  expect(ratePercent('20')).toBe('20%');
});

test.each([
  ['undefined', undefined],
  ['empty', {}],
  ['an empty class', { standard: [] }],
])('Tax Rates with %s rates reads the empty line', (_name, taxRates) => {
  render(<TaxSettings siteHome={siteHome} settings={{ ...settings, taxRates }} />);
  expect(screen.getByTestId('settings-tax-rates-empty').textContent).toBe("No tax rates apply at the store's address.");
  expect(screen.queryByTestId('settings-tax-rates-note')).toBeNull();
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
