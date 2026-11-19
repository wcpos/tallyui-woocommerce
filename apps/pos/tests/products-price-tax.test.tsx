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

// A variable product whose variations are not taxable themselves: only the parent's tax status can make words (v2
// variable-price.tsx:23-24 passes the parent's).
function variable(prices: [string, string], taxStatus: 'taxable' | 'none' = 'taxable') {
  const variation = (id: number, price: string) => ({ ...product(id, `Hoodie ${id}`, price, 'none'), type: 'variation', status: 'publish' });
  return { ...product(3, 'Hoodie', '', taxStatus), type: 'variable', variations: [31, 32],
    variation_docs: [variation(31, prices[0]), variation(32, prices[1])] };
}

function renderProducts(options: { price?: string; tax?: TileTax | null; hoodie?: ReturnType<typeof variable> } = {}) {
  const products = [product(1, 'Tea', options.price ?? '8.60', 'taxable'), product(2, 'Mug', '5.00', 'none'), options.hoodie ?? variable(['20.00', '40.00'])];
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

test('with Tax on, a variable product\'s range carries the tax words under each end, min then max', () => {
  renderProducts();
  switchTaxOn();
  const min = screen.getByTestId('product-price-tax-3-min');
  const max = screen.getByTestId('product-price-tax-3-max');
  expect(min.textContent).toBe('excl. $2.00 tax');
  expect(max.textContent).toBe('excl. $4.00 tax');
  expect(screen.getByTestId('product-price-3-min').textContent).toBe('$20.00');
  expect(screen.getByTestId('product-price-3-max').textContent).toBe('$40.00');
  expect(min.compareDocumentPosition(max) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const cell = screen.getByTestId('product-cell-price-3');
  expect(cell.contains(min) && cell.contains(max)).toBe(true);
  expect(screen.queryByTestId('product-price-tax-3')).toBeNull();
});

test('a variable product whose variations cost the same shows one price with one tax line', () => {
  renderProducts({ hoodie: variable(['30.00', '30.00']) });
  switchTaxOn();
  expect(screen.getByTestId('product-price-3').textContent).toBe('$30.00');
  expect(screen.getByTestId('product-price-tax-3').textContent).toBe('excl. $3.00 tax');
  expect(screen.queryByTestId('product-price-3-min')).toBeNull();
  expect(screen.queryByTestId('product-price-tax-3-max')).toBeNull();
});

test('with Tax off, each end\'s words are that end\'s tooltip', () => {
  renderProducts();
  expect(screen.getByTestId('product-price-3').textContent).toBe('$20.00 - $40.00');
  expect(screen.queryByTestId('product-price-tax-3-min')).toBeNull();
  expect(screen.queryByTestId('product-price-tax-3-max')).toBeNull();
  fireEvent.pointerEnter(screen.getByTestId('product-price-trigger-3-min'));
  expect(screen.getByRole('tooltip').textContent).toBe('excl. $2.00 tax');

  cleanup();
  renderProducts();
  fireEvent.pointerEnter(screen.getByTestId('product-price-trigger-3-max'));
  expect(screen.getByRole('tooltip').textContent).toBe('excl. $4.00 tax');
});

test('a variable product that is not taxable, or with taxes off, shows no tax words at either end', () => {
  renderProducts({ hoodie: variable(['20.00', '40.00'], 'none') });
  switchTaxOn();
  expect(screen.getByTestId('product-price-tax-1').textContent).toBe('excl. $0.86 tax');
  for (const end of ['min', 'max']) {
    expect(screen.queryByTestId(`product-price-tax-3-${end}`)).toBeNull();
    expect(screen.queryByTestId(`product-price-trigger-3-${end}`)).toBeNull();
  }

  cleanup();
  renderProducts({ tax: null });
  for (const end of ['min', 'max']) {
    expect(screen.queryByTestId(`product-price-trigger-3-${end}`)).toBeNull();
    fireEvent.pointerEnter(screen.getByTestId(`product-price-3-${end}`));
  }
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.getByTestId('product-price-3').textContent).toBe('$20.00 - $40.00');
});
