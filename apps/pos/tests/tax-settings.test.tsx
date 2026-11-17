import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { StoreSettings, StoreTaxRate } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { TaxSettings, shippingTaxClassLabel, wooTaxSettingsUrl } from '../components/settings/tax-settings';
import { phoneLocation, phoneTags, ratePercent, rateTags } from '../components/settings/tax-rates-dialog';
import { classesOf } from './classes-of';
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
  expect(screen.getAllByText('Set in WooCommerce')).toHaveLength(9);
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
});

test('the Display section shows WooCommerce\'s display options read-only, each set in WooCommerce', () => {
  render(<TaxSettings settings={settings} siteHome={siteHome} store={{
    taxTotalDisplay: 'itemized', taxDisplayShop: 'excl', taxDisplayCart: 'incl', priceDisplaySuffix: 'incl. VAT',
  }} />);
  const display = within(screen.getByTestId('settings-tax-display'));
  expect(display.getByText('Display')).not.toBeNull();
  expect(display.getAllByText('Set in WooCommerce')).toHaveLength(4);
  const labels = display.getAllByText(
    /^(Display Tax Totals|Display Prices in the Shop|Display Prices During Cart and Checkout|Price Display Suffix)$/);
  expect(labels.map(node => node.textContent)).toEqual([
    'Display Tax Totals', 'Display Prices in the Shop', 'Display Prices During Cart and Checkout', 'Price Display Suffix',
  ]);
  for (const [field, value, label, checked] of [
    ['tax_total_display', 'single', 'As a single total', 'false'],
    ['tax_total_display', 'itemized', 'Itemized', 'true'],
    ['tax_display_shop', 'incl', 'Including tax', 'false'],
    ['tax_display_shop', 'excl', 'Excluding tax', 'true'],
    ['tax_display_cart', 'incl', 'Including tax', 'true'],
    ['tax_display_cart', 'excl', 'Excluding tax', 'false'],
  ]) {
    const segment = display.getByTestId(`settings-tax-locked-${field}-segments-segment-${value}`);
    expect(segment.textContent).toBe(label);
    expect(segment.getAttribute('aria-checked')).toBe(checked);
    expect(segment.getAttribute('aria-disabled')).toBe('true');
  }
  expect(display.getByTestId('settings-tax-locked-price_display_suffix-value').textContent).toBe('incl. VAT');
});

test('a locked display segment does not change when pressed', () => {
  render(<TaxSettings settings={settings} siteHome={siteHome} store={{ taxDisplayShop: 'excl' }} />);
  fireEvent.click(screen.getByTestId('settings-tax-locked-tax_display_shop-segments-segment-incl'));
  expect(screen.getByTestId('settings-tax-locked-tax_display_shop-segments-segment-excl').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-tax-locked-tax_display_shop-segments-segment-incl').getAttribute('aria-checked')).toBe('false');
});

test('before the store says, the Display rows read the dash', () => {
  render(<TaxSettings settings={settings} siteHome={siteHome} />);
  for (const field of ['tax_total_display', 'tax_display_shop', 'tax_display_cart', 'price_display_suffix']) {
    expect(screen.getByTestId(`settings-tax-locked-${field}-value`).textContent).toBe('—');
  }
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

test('the sections read Calculation, Display, Tax Rates', () => {
  render(<TaxSettings settings={settings} siteHome={siteHome} />);
  expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Calculation', 'Display', 'Tax Rates']);
});

test('Open on a Display row opens the WooCommerce tax settings tab', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<TaxSettings settings={settings} siteHome={siteHome} />);
  fireEvent.click(screen.getByTestId('settings-tax-locked-tax_display_cart-open'));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://shop.example/wp-admin/admin.php?page=wc-settings&tab=tax');
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

// Two standard rates (one with an empty state and cities, one compound with no class) and one reduced rate.
const allTaxRates: StoreTaxRate[] = [
  { id: '1', name: 'State Tax', rate: '6.0000', taxClass: 'standard', priority: 1,
    location: { country: 'US', region: '', postcodes: ['73301'], cities: ['Austin', 'Dallas'] } },
  { id: '2', name: 'County', rate: '2.2500', taxClass: '', priority: 2, compound: true, location: { country: 'US', region: 'TX' } },
  { id: '3', name: 'Reduced', rate: '5.0000', taxClass: 'reduced-rate', priority: 1, location: { country: 'GB' } },
];
const taxClassSlugs = ['standard', 'reduced-rate', 'zero-rate'];
// The page's settings also carry the address-filtered `taxRates`, which the page must not list inline.
const inline = { standard: [{ id: 1, code: 'US-TX', label: 'State Tax', rate: '6.0000', priority: 1, compound: false, shipping: true }] };

function openRates(more: Partial<StoreSettings> = { allTaxRates, taxClassSlugs }) {
  render(<><TaxSettings siteHome={siteHome} settings={{ ...settings, taxRates: inline, ...more }} /><PortalHost /></>);
  fireEvent.click(screen.getByText('View all tax rates'));
  return within(screen.getByTestId('tax-rates-dialog'));
}
const cells = (id: string) => within(screen.getByTestId(`tax-rates-row-${id}`)).getAllByRole('cell').map(cell => cell.textContent);

test('the Tax Rates section holds only the View all tax rates button', () => {
  const page = { ...settings, taxRates: inline, allTaxRates, taxClassSlugs };
  render(<TaxSettings siteHome={siteHome} settings={page} />);
  const section = within(screen.getByTestId('settings-tax-rates'));
  expect(section.getByText('Tax Rates')).not.toBeNull();
  expect(section.getByText('View all tax rates')).not.toBeNull();
  expect(screen.queryAllByTestId(/^settings-tax-rate-/)).toHaveLength(0);
  expect(screen.queryByText('State Tax')).toBeNull();
  expect(screen.queryByTestId('tax-rates-dialog')).toBeNull();
});

test('View all opens the dialog: a tab per class with its count, and the standard rates in seven columns', () => {
  const dialog = openRates();
  expect(screen.queryByTestId('tax-rates-list')).toBeNull();
  expect(dialog.getByTestId('tax-rates-title').textContent).toBe('Tax Rates');
  expect(dialog.getByRole('tablist')).not.toBeNull();
  expect(taxClassSlugs.map(slug => screen.getByTestId(`tax-rates-tab-${slug}`).textContent))
    .toEqual(['Standard2', 'Reduced rate1', 'Zero rate0']);
  expect(dialog.getAllByRole('columnheader').map(head => head.textContent))
    .toEqual(['Country', 'State', 'Postcode', 'City', 'Rate', 'Name', 'Priority']);
  expect(cells('1')).toEqual(['US', 'Any', '73301', 'Austin, Dallas', '6%', 'State Tax', '1']);
  expect(cells('2')).toEqual(['US', 'TX', 'Any', 'Any', '2.25%', 'CountyCompound', '2']);
  expect(screen.queryByTestId('tax-rates-row-3')).toBeNull();
  expect(screen.getByTestId('tax-rates-count').textContent).toBe('3 tax rates');
});

test('the Reduced rate tab shows its rate and hides the standard ones', () => {
  openRates();
  fireEvent.click(screen.getByTestId('tax-rates-tab-reduced-rate'));
  expect(cells('3')).toEqual(['GB', 'Any', 'Any', 'Any', '5%', 'Reduced', '1']);
  expect(screen.queryByTestId('tax-rates-row-1')).toBeNull();
  expect(screen.queryByTestId('tax-rates-row-2')).toBeNull();
});

test('a class with no rates shows the empty state, as does every class when the connector read no list', () => {
  openRates();
  fireEvent.click(screen.getByTestId('tax-rates-tab-zero-rate'));
  expect(screen.getByTestId('tax-rates-empty').textContent).toBe('No rates in this class');
  cleanup();
  openRates({ allTaxRates: undefined, taxClassSlugs });
  expect(screen.getByTestId('tax-rates-tab-standard').textContent).toBe('Standard0');
  expect(screen.getByTestId('tax-rates-empty').textContent).toBe('No rates in this class');
  expect(screen.getByTestId('tax-rates-count').textContent).toBe('0 tax rates');
});

test('a phone folds the tab strip into a Select', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  openRates();
  expect(screen.getByTestId('tax-rates-class-select').textContent).toContain('Standard 2');
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(within(screen.getByTestId('tax-rates-row-1')).getByText('State Tax')).not.toBeNull();
});

test('a phone shows v2\'s list rows in place of the table', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  openRates();
  expect(screen.queryByTestId('tax-rates-table')).toBeNull();
  expect(screen.getByTestId('tax-rates-list')).not.toBeNull();
  expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  const row1 = screen.getByTestId('tax-rates-row-1');
  expect(within(row1).getByText('State Tax')).not.toBeNull();
  expect(screen.getByTestId('tax-rates-row-1-location').textContent).toBe('US · any state · 73301 · Austin, Dallas');
  expect(screen.queryByTestId('tax-rates-row-1-tags')).toBeNull();
  expect(screen.getByTestId('tax-rates-row-1-rate').textContent).toBe('6%');
  expect(screen.getByTestId('tax-rates-row-2-location').textContent).toBe('US · TX');
  expect(screen.getByTestId('tax-rates-row-2-tags').textContent).toBe('Compound · priority 2');
  expect(screen.getByTestId('tax-rates-row-2-rate').textContent).toBe('2.25%');
  expect(classesOf('tax-rates-row-1')).toEqual(expect.arrayContaining(['min-h-14', 'flex-row', 'items-center', 'border-b', 'border-border']));
  expect(classesOf('tax-rates-row-1-location')).toEqual(expect.arrayContaining(['text-sm', 'text-muted-foreground']));
  expect(classesOf('tax-rates-row-2-tags')).toEqual(expect.arrayContaining(['text-xs', 'text-muted-foreground']));
  expect(classesOf('tax-rates-row-1-rate')).toEqual(expect.arrayContaining(['font-semibold', 'tabular-nums']));
  expect(screen.queryByTestId('tax-rates-row-3')).toBeNull();
});

test('a phone keeps the empty state for a class with no rates', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  openRates({ allTaxRates: undefined, taxClassSlugs });
  expect(screen.getByTestId('tax-rates-empty').textContent).toBe('No rates in this class');
  expect(screen.queryByTestId('tax-rates-list')).toBeNull();
});

test('Close closes the dialog', () => {
  openRates();
  // The app's sheet Close: v2's 44 px `h-ctl` footer button (#237).
  expect(classesOf('tax-rates-close')).toContain('h-11');
  fireEvent.click(screen.getByTestId('tax-rates-close'));
  expect(screen.queryByTestId('tax-rates-dialog')).toBeNull();
});

test('the header × closes the dialog, as v2\'s does', () => {
  openRates();
  expect(classesOf('tax-rates-close-x')).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  fireEvent.click(screen.getByTestId('tax-rates-close-x'));
  expect(screen.queryByTestId('tax-rates-dialog')).toBeNull();
});

test('the class tabs are v2\'s underline tabs: the count inline, the active one underlined in primary', () => {
  const dialog = openRates();
  expect(classesOf('tax-rates-tab-standard')).toEqual(expect.arrayContaining(['border-b-2', 'border-primary', 'bg-transparent']));
  expect(classesOf('tax-rates-tab-reduced-rate')).toEqual(expect.arrayContaining(['border-b-2', 'border-transparent']));
  expect(classesOf('tax-rates-tab-reduced-rate')).not.toContain('border-primary');
  // The count is a sibling Text on the trigger's row (v2 tabs/index.tsx:343 `flex-row`), not a line under the name.
  const [name, count] = Array.from(screen.getByTestId('tax-rates-tab-standard').children);
  expect([name?.textContent, count?.textContent]).toEqual(['Standard', '2']);
  for (const slug of taxClassSlugs) expect(classesOf(`tax-rates-tab-${slug}`)).toContain('flex-row');
  expect(dialog.getByRole('tablist')).not.toBeNull();
  fireEvent.click(screen.getByTestId('tax-rates-tab-reduced-rate'));
  expect(classesOf('tax-rates-tab-reduced-rate')).toContain('border-primary');
  expect(classesOf('tax-rates-tab-standard')).not.toContain('border-primary');
});

test('the count row carries v2\'s sync icon: a 24 px button by the count, disabled with no refresh to run', () => {
  openRates();
  const sync = screen.getByTestId('tax-rates-sync');
  expect(sync.parentElement).toBe(screen.getByTestId('tax-rates-count').parentElement);
  expect(classesOf('tax-rates-sync')).toEqual(expect.arrayContaining(['h-6', 'w-6']));
  expect(sync.getAttribute('aria-disabled')).toBe('true');
  expect(sync.querySelector('svg')?.getAttribute('width')).toBe('14');
});

test('the tab rule runs under the tabs only, the strip inset 24 px as v2\'s scrolling list is', () => {
  openRates();
  const list = classesOf('tax-rates-tablist');
  expect(list).toEqual(expect.arrayContaining(['mx-6', 'self-start', 'border-b', 'border-border']));
  expect(list).not.toContain('mx-4');
});

test('rateTags and ratePercent follow v2', () => {
  expect(rateTags({ compound: true, shipping: false })).toBe('Compound · Not on shipping');
  expect(rateTags({ compound: false, shipping: true })).toBe('');
  expect(ratePercent('10.0000')).toBe('10%');
  expect(ratePercent('8.2500')).toBe('8.25%');
  expect(ratePercent('20')).toBe('20%');
});

test('phoneLocation reads v2\'s location line', () => {
  expect(phoneLocation({ location: { country: 'GB' } })).toBe('GB · any state, postcode or city');
  expect(phoneLocation({ location: { country: '', region: '', postcodes: [], cities: [] } })).toBe('Any · any state, postcode or city');
  expect(phoneLocation({ location: { country: 'GB', cities: ['PORTLAND'] } })).toBe('GB · any state · PORTLAND');
  expect(phoneLocation({ location: { country: 'US', region: 'AL', postcodes: ['12345', '123456'] } })).toBe('US · AL · 12345, 123456');
});

test('phoneTags adds the priority only when it is not the default', () => {
  expect(phoneTags({})).toBe('');
  expect(phoneTags({ priority: 1 })).toBe('');
  expect(phoneTags({ compound: true, priority: 2 })).toBe('Compound · priority 2');
  expect(phoneTags({ shipping: false })).toBe('Not on shipping');
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
