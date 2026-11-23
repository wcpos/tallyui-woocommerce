import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost, type SaleScreenProps } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

const props: SaleScreenProps = {
  storeSettings: { ...noTaxSettings, preventOverselling: true },
  connector: createWooCommerceConnector(), currency: stores[0].currency,
  products: [{ ...products[0], stock_quantity: 1 }],
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setLineQuantity(name: string, quantity: number) {
  fireEvent.click(screen.getByLabelText(`Edit quantity of ${name}`));
  for (const digit of String(quantity)) fireEvent.click(screen.getByTestId(`quantity-popover-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('quantity-popover-apply'));
}

test('with prevent overselling on, raising a line past stock is refused with Only 1 available', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  act(() => dismissToast());
  setLineQuantity('Espresso', 2);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('1');
  expect(getToasts()).toEqual([expect.objectContaining({ type: 'warning', title: 'Only 1 available for Espresso' })]);
});

test('raising a line whose product left the device is refused as not loaded', () => {
  const view = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  view.rerender(<SaleScreen {...props} products={[]} />);
  act(() => dismissToast());
  setLineQuantity('Espresso', 2);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('1');
  expect(getToasts()).toEqual([expect.objectContaining({
    type: 'warning', title: "Stock for Espresso hasn't loaded on this device yet. Try again in a moment.",
  })]);
});

test('lowering a line whose product left the device is not checked', () => {
  const view = render(<SaleScreen {...props} products={[{ ...products[0], stock_quantity: 2 }]} />);
  for (let i = 0; i < 2; i++) fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('2');
  view.rerender(<SaleScreen {...props} products={[]} />);
  act(() => dismissToast());
  setLineQuantity('Espresso', 1);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('1');
  expect(getToasts()).toEqual([]);
});

test('with prevent overselling off, a line can be raised past stock', () => {
  render(<SaleScreen {...props} storeSettings={{ ...noTaxSettings, preventOverselling: false }} />);
  fireEvent.click(screen.getByText('Espresso'));
  act(() => dismissToast());
  setLineQuantity('Espresso', 2);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('2');
  expect(getToasts()).toEqual([]);
});

test('lowering a line is never checked', () => {
  const view = render(<SaleScreen {...props} products={[{ ...products[0], stock_quantity: 3 }]} />);
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('3');
  view.rerender(<SaleScreen {...props} products={[{ ...products[0], stock_quantity: 1 }]} />);
  act(() => dismissToast());
  setLineQuantity('Espresso', 2);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('2');
  expect(getToasts()).toEqual([]);
});

test('raising a backorder-notify line adds and warns it will be backordered', () => {
  render(<SaleScreen {...props} products={[{ ...products[0], stock_quantity: 1, backorders: 'notify' }]} />);
  fireEvent.click(screen.getByText('Espresso'));
  act(() => dismissToast());
  setLineQuantity('Espresso', 2);
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('2');
  expect(getToasts()).toEqual([expect.objectContaining({ type: 'warning', title: 'Espresso will be backordered' })]);
});

test('another line of the same parent-managed product counts against the raise', () => {
  const shirt = { ...products[2], manage_stock: true, stock_quantity: 3,
    variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id)
      .map(doc => ({ ...doc.payload, manage_stock: 'parent', stock_quantity: null })) };
  render(<SaleScreen {...props} products={[shirt]} />);
  fireEvent.click(screen.getByTestId('product-tile-102'));
  fireEvent.click(screen.getByTestId('variation-tile-104'));
  fireEvent.click(screen.getByTestId('variation-tile-105'));
  expect(screen.getByLabelText('Edit quantity of T-Shirt · S / Black').textContent).toBe('1');
  expect(screen.getByLabelText('Edit quantity of T-Shirt · S / White').textContent).toBe('1');
  act(() => dismissToast());
  setLineQuantity('T-Shirt · S / Black', 2);
  expect(screen.getByLabelText('Edit quantity of T-Shirt · S / Black').textContent).toBe('2');
  expect(getToasts()).toEqual([]);
  setLineQuantity('T-Shirt · S / Black', 3);
  expect(screen.getByLabelText('Edit quantity of T-Shirt · S / Black').textContent).toBe('2');
  expect(screen.getByLabelText('Edit quantity of T-Shirt · S / White').textContent).toBe('1');
  expect(getToasts()).toEqual([expect.objectContaining({ type: 'warning', title: 'Only 3 available for T-Shirt · S / Black' })]);
});
