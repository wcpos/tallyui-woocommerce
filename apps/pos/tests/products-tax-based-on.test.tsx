import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreSettings } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import { ProductsTaxBasedOn } from '../components/products-tax-based-on';
import { noTaxSettings } from './fixtures/store-settings';

const mocks = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock('expo-router', () => ({ useRouter: () => mocks.router }));

const connector = createWooCommerceConnector();
const product = {
  id: 1, name: 'Tea', type: 'simple', status: 'publish', sku: 'SKU-1', price: '10.00', regular_price: '10.00', sale_price: '',
  on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
  categories: [], images: [], variations: [], meta_data: [],
};

// The shop sits in Los Angeles; the table also holds a GB rate the shop base must not match.
const settings: StoreSettings = {
  ...noTaxSettings, taxBasedOn: 'base',
  baseTaxAddress: { country: 'US', state: 'CA', city: 'Los Angeles', postcode: '90001' },
  taxRateTable: [
    { id: 1, country: 'US', state: 'CA', postcode: '', city: '', postcodes: [], cities: [], rate: '10.0000',
      name: 'CA Tax', class: 'standard', priority: 1, compound: false, shipping: true, order: 0 },
    { id: 2, country: 'GB', state: '', postcode: '', city: '', postcodes: [], cities: [], rate: '20.0000',
      name: 'VAT', class: 'standard', priority: 1, compound: false, shipping: true, order: 0 },
  ],
  allTaxRates: [{ id: '1', name: 'CA Tax', rate: '10.0000', taxClass: 'standard', priority: 1, location: { country: 'US', region: 'CA' } }],
  taxClassSlugs: ['standard'],
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  mocks.router.push.mockClear();
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderScreen(calcTaxes: boolean | undefined, store: StoreSettings = settings) {
  render(<ProductsScreen products={[product]} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()}
    captionStart={<ProductsTaxBasedOn settings={store} calcTaxes={calcTaxes} />} />,
  { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}

function openPanel(): HTMLElement {
  fireEvent.click(screen.getByTestId('tax-based-on-trigger'));
  return screen.getByTestId('tax-based-on-content');
}

test('taxes on: the footer shows Shop base, and the panel the shop address and its rate', () => {
  renderScreen(true);
  const start = screen.getByTestId('products-caption-start');
  expect(start.querySelector('[data-testid="tax-based-on-value"]')?.textContent).toBe('Shop base');
  const panel = openPanel().textContent;
  expect(panel).toContain('Shop base address');
  expect(panel).toContain('Shop address');
  expect(panel).toContain('Los Angeles CA 90001, United States (US)');
  expect(panel).toContain('CA Tax');
  expect(panel).toContain('10%');
  expect(panel).not.toContain('VAT');
});

test('taxes off: no trigger', () => {
  renderScreen(false);
  expect(screen.queryByTestId('tax-based-on-trigger')).toBeNull();
  expect(screen.getByTestId('products-caption-start').childNodes).toHaveLength(0);
  // The count keeps its place at the row's end.
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1 of 1');
});

test('View all tax rates opens the Tax Rates dialog with the shop address: its rate marked and counted', async () => {
  renderScreen(true);
  openPanel();
  fireEvent.click(screen.getByTestId('tax-based-on-view-all'));
  await waitFor(() => expect(screen.getByTestId('tax-rates-dialog')).not.toBeNull());
  expect(screen.getByTestId('tax-rates-title').textContent).toBe('Tax Rates');
  expect(screen.getByTestId('tax-rates-dialog').textContent).toContain('CA Tax');
  // v2 display-current-tax-rates.tsx:92-106: the panel's address travels with View all.
  expect(screen.getByTestId('tax-rates-row-1').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('tax-rates-count').textContent).toBe('1 tax rate · 1 applies to this address (US)');
});

test('Change in Settings › Tax goes to the Tax page', () => {
  renderScreen(true);
  openPanel();
  fireEvent.click(screen.getByTestId('tax-based-on-change-setting'));
  expect(mocks.router.push).toHaveBeenCalledWith('/settings/tax');
});

test("no rate for the shop's country: the panel shows the failed step", () => {
  renderScreen(true, { ...settings, baseTaxAddress: { country: 'FR', state: '', city: 'Paris', postcode: '75001' } });
  expect(screen.getByTestId('tax-based-on-trigger').getAttribute('data-tone')).toBe('bad');
  const panel = openPanel().textContent;
  expect(panel).toContain('No rate matches it');
  expect(panel).toContain('The store has no tax rate for France (FR)');
  expect(panel).toContain('Paris');
});
