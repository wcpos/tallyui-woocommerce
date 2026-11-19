// v2's Price column Tax switch (WCPOS monorepo `contexts/ui-settings/initial-settings.json:322-332`,
// `products/cells/price.tsx:24`, `components/product/price-with-tax.tsx:54-95`, core.json `common.excl_tax_amount`
// "excl. {amount} tax", `common.incl_tax_amount` "incl. {amount} tax", `common.tax` "Tax"): off by default, nested one
// gutter in under Price; on, a taxable price carries its tax line under it; off, the same line is the price's tooltip.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { moneyFromDecimalString } from '@tallyui/core';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import { areaColumnsKey } from '../lib/area-columns';
import { tileTaxLine } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { classesOf } from './classes-of';
import { memoryStorage } from './memory-storage';

const connector = createWooCommerceConnector();
const SWITCH = 'products-display-column-price-tax';
// A 10% rate on every class.
const tax = (pricesIncludeTax: boolean): TileTax => ({ pricesIncludeTax, getTaxRatePpm: () => 100_000 });

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function product(id: number, name: string, price: string, taxStatus: 'taxable' | 'none') {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, price, regular_price: price, sale_price: '', on_sale: false,
    purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false, tax_status: taxStatus, tax_class: '',
    categories: [], tags: [], images: [], variations: [], attributes: [], meta_data: [], date_modified_gmt: '2026-10-05T12:00:00',
  };
}

function renderProducts(options: { price?: string; tax?: TileTax | null } = {}) {
  const products = [product(1, 'Tea', options.price ?? '8.60', 'taxable'), product(2, 'Mug', '5.00', 'none')];
  render(<ProductsScreen products={products} connector={connector} currency="USD" locale="en_US"
    tax={options.tax === null ? undefined : options.tax ?? tax(false)} onBack={vi.fn()} />,
  { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}

function openPanel() {
  fireEvent.click(screen.getByTestId('products-bar-display'));
  return screen.getByTestId('products-display-options');
}

function switchTaxOn() {
  openPanel();
  fireEvent.click(screen.getByTestId(SWITCH));
  expect(screen.getByTestId(SWITCH).getAttribute('aria-checked')).toBe('true');
}

test('the Price column carries one nested Tax switch, off, one gutter in, only while Price is shown', () => {
  renderProducts();
  openPanel();
  const group = screen.getByTestId('products-display-column-price-display');
  expect(classesOf('products-display-column-price-display')).toContain('pl-12');
  expect(Array.from(group.querySelectorAll('[role="switch"]')).map(node => node.getAttribute('data-testid'))).toEqual([SWITCH]);
  expect(screen.getByTestId(SWITCH).getAttribute('aria-label')).toBe('Show Tax');
  expect(screen.getByTestId(SWITCH).getAttribute('aria-checked')).toBe('false');
  expect(group.textContent).toBe('Tax');

  fireEvent.click(screen.getByTestId('products-display-column-price'));
  expect(screen.queryByTestId('products-display-column-price-display')).toBeNull();
  expect(screen.queryByTestId(SWITCH)).toBeNull();
  fireEvent.click(screen.getByTestId('products-display-column-price'));
  expect(screen.getByTestId(SWITCH).getAttribute('aria-checked')).toBe('false');
});

test.each([
  [false, '8.60', '$8.60', 'excl. $0.86 tax'],
  [true, '9.46', '$9.46', 'incl. $0.86 tax'],
] as const)('with Tax on, a taxable price shows the tax line under it in v2\'s copy (prices include tax: %s)', (included, price, shown, copy) => {
  renderProducts({ price, tax: tax(included) });
  switchTaxOn();
  const line = screen.getByTestId('product-price-tax-1');
  expect(line.textContent).toBe(copy);
  // The till's own helper gives the same words for the same price and settings.
  expect(line.textContent).toBe(tileTaxLine(moneyFromDecimalString(price, 'USD')!, 'taxable', '', tax(included)));
  expect(screen.getByTestId('product-cell-price-1').contains(line)).toBe(true);
  expect(screen.getByTestId('product-price-1').textContent).toBe(shown);
});

test('with Tax off, no line is drawn and the same text is the price\'s tooltip', () => {
  renderProducts();
  expect(screen.queryByTestId('product-price-tax-1')).toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.getByTestId('product-price-1').textContent).toBe('$8.60');
  const trigger = screen.getByTestId('product-price-trigger-1');
  expect(trigger.contains(screen.getByTestId('product-price-1'))).toBe(true);
  fireEvent.pointerEnter(trigger);
  expect(screen.getByRole('tooltip').textContent).toBe('excl. $0.86 tax');
});

test('a product that is not taxable shows no tax line either way', () => {
  renderProducts();
  expect(screen.queryByTestId('product-price-trigger-2')).toBeNull();
  fireEvent.pointerEnter(screen.getByTestId('product-price-2'));
  expect(screen.queryByRole('tooltip')).toBeNull();
  switchTaxOn();
  expect(screen.getByTestId('product-price-tax-1').textContent).toBe('excl. $0.86 tax');
  expect(screen.queryByTestId('product-price-tax-2')).toBeNull();
  expect(screen.getByTestId('product-price-2').textContent).toBe('$5.00');

  // Without the till's tax settings (taxes off, or settings not in) nothing is drawn either.
  cleanup();
  renderProducts({ tax: null });
  expect(screen.queryByTestId('product-price-tax-1')).toBeNull();
  expect(screen.queryByTestId('product-price-trigger-1')).toBeNull();
  fireEvent.pointerEnter(screen.getByTestId('product-price-1'));
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('the choice survives a remount and Restore turns it off', () => {
  renderProducts();
  switchTaxOn();
  const stored = JSON.parse(localStorage.getItem(areaColumnsKey('products'))!);
  expect(stored.find((row: { id: string }) => row.id === 'price')).toEqual({ id: 'price', visible: true, display: [{ id: 'tax', visible: true }] });

  cleanup();
  renderProducts();
  expect(screen.getByTestId('product-price-tax-1').textContent).toBe('excl. $0.86 tax');
  openPanel();
  expect(screen.getByTestId(SWITCH).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('products-display-restore'));
  expect(screen.getByTestId(SWITCH).getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByTestId('product-price-tax-1')).toBeNull();
});
