import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { GeneralSettings, countryLabel, type DefaultCustomerControl } from '../components/settings/general-settings';
import type { DefaultCustomerSetting } from '../lib/customers/default-customer';

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

const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
function renderDefaultCustomer(setting: DefaultCustomerSetting, customer: DefaultCustomerControl['customer'] = null) {
  const onChange = vi.fn<DefaultCustomerControl['onChange']>();
  const source = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  // The customer dropdown is a popover, drawn in the portal host.
  render(<><GeneralSettings store={store} siteHome={siteHome} defaultCustomer={{ setting, customer, source, onChange }} /><PortalHost /></>);
  return { onChange, source };
}
const defaultRow = () => within(screen.getByTestId('settings-general-default_customer'));

test('Default Customer and "is cashier" sit under Localization after Language, with v2\'s help text', () => {
  renderDefaultCustomer({ customerId: 0, isCashier: false });
  const localization = within(screen.getByTestId('settings-general-localization'));
  expect(localization.getAllByText(/^(Language|Default Customer|Default Customer is cashier)$/).map(node => node.textContent))
    .toEqual(['Language', 'Default Customer', 'Default Customer is cashier']);
  expect(defaultRow().getByText('Pre-selected on every new cart.')).not.toBeNull();
  expect(localization.getByTestId('settings-general-default_customer_is_cashier')).not.toBeNull();
});

test('the Default Customer select shows the stored customer, picks another, and keeps Guest choosable', async () => {
  const { onChange } = renderDefaultCustomer({ customerId: 3, isCashier: false }, { id: '3', name: 'Anna Bell' });
  expect(defaultRow().getByRole('button', { name: 'Customer: Anna Bell' })).not.toBeNull();
  fireEvent.click(defaultRow().getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(onChange).toHaveBeenLastCalledWith({ customerId: 7, isCashier: false });
  expect(defaultRow().getByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  fireEvent.click(defaultRow().getByTestId('cart-customer-name'));
  await act(async () => { fireEvent.click(screen.getByTestId('customer-option-guest')); });
  expect(onChange).toHaveBeenLastCalledWith({ customerId: 0, isCashier: false });
  expect(defaultRow().getByRole('button', { name: 'Customer: Guest' })).not.toBeNull();
});

test('turning "is cashier" on saves it and disables the Default Customer select', () => {
  const { onChange } = renderDefaultCustomer({ customerId: 7, isCashier: false }, gee);
  fireEvent.click(screen.getByTestId('settings-general-default_customer_is_cashier-switch'));
  expect(onChange).toHaveBeenLastCalledWith({ customerId: 7, isCashier: true });
});

test('while "is cashier" is on, the Default Customer select is disabled and shows the stored customer', () => {
  const { onChange, source } = renderDefaultCustomer({ customerId: 7, isCashier: true }, gee);
  expect(defaultRow().queryByTestId('cart-customer-name')).toBeNull();
  const select = defaultRow().getByTestId('settings-general-default_customer-select');
  expect(select.getAttribute('aria-disabled')).toBe('true');
  expect(select.textContent).toBe('Gee Four');
  fireEvent.click(select);
  expect(screen.queryByPlaceholderText('Search Customers')).toBeNull();
  expect(source.search).not.toHaveBeenCalled();
  expect((screen.getByTestId('settings-general-default_customer_is_cashier-switch') as HTMLElement)
    .getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('settings-general-default_customer_is_cashier-switch'));
  expect(onChange).toHaveBeenLastCalledWith({ customerId: 7, isCashier: false });
});

test('the number format rows are locked under Currency & numbers, after Currency, in v2\'s order', () => {
  render(<GeneralSettings siteHome={siteHome} store={{ ...store,
    numberFormat: { position: 'left_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 3 } }} />);
  const currency = within(screen.getByTestId('settings-general-currency'));
  expect(currency.getAllByText(/^(Currency|Currency Position|Decimal Separator|Number of Decimals|Thousand Separator)$/)
    .map(node => node.textContent))
    .toEqual(['Currency', 'Currency Position', 'Decimal Separator', 'Number of Decimals', 'Thousand Separator']);
  expect(value('currency_pos')).toBe('Left with space');
  expect(value('price_thousand_sep')).toBe('.');
  expect(value('price_decimal_sep')).toBe(',');
  expect(value('price_num_decimals')).toBe('3');
  for (const id of ['currency_pos', 'price_thousand_sep', 'price_decimal_sep', 'price_num_decimals']) {
    expect(currency.getByTestId(`settings-general-locked-${id}-open`)).not.toBeNull();
    expect(within(screen.getByTestId(`settings-general-locked-${id}`)).getByText('Set in WooCommerce')).not.toBeNull();
  }
});

test.each([['left', 'Left'], ['right', 'Right'], ['left_space', 'Left with space'], ['right_space', 'Right with space']] as const)(
  'Currency Position %j reads %j', (position, label) => {
    render(<GeneralSettings siteHome={siteHome} store={{ ...store, numberFormat: { position } }} />);
    expect(value('currency_pos')).toBe(label);
  });

test('an empty thousand separator reads as a dash, and 0 decimals as 0', () => {
  render(<GeneralSettings siteHome={siteHome} store={{ ...store, numberFormat: { thousandSeparator: '', decimals: 0 } }} />);
  expect(value('price_thousand_sep')).toBe('—');
  expect(value('price_num_decimals')).toBe('0');
  expect(value('currency_pos')).toBe('—');
});

test('countryLabel names the region, and falls back for a code Intl cannot name', () => {
  expect(countryLabel('US')).toBe('United States (US)');
  expect(countryLabel('GB')).toBe('United Kingdom (GB)');
  expect(countryLabel(undefined)).toBeUndefined();
  // Intl answers "Unknown Region" for an unassigned code, and throws on a malformed one.
  expect(countryLabel('ZZ')).toBe('Unknown Region (ZZ)');
  expect(countryLabel('not a code')).toBe('not a code');
});
