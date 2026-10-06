import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('products sit left of the cart by default', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const productsPanel = screen.getByTestId('pos-products-panel');
  const cartPanel = screen.getByTestId('pos-cart-panel');
  expect(productsPanel.compareDocumentPosition(cartPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('a stored right position puts the cart first', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"position":"right"}');
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const productsPanel = screen.getByTestId('pos-products-panel');
  const cartPanel = screen.getByTestId('pos-cart-panel');
  expect(cartPanel.compareDocumentPosition(productsPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('choosing Products right in settings moves the panes at once', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const productsPanel = screen.getByTestId('pos-products-panel');
  const cartPanel = screen.getByTestId('pos-cart-panel');
  expect(productsPanel.compareDocumentPosition(cartPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('panel-position-right'));
  expect(screen.getByTestId('pos-products-panel')).toBe(productsPanel);
  expect(screen.getByTestId('pos-cart-panel')).toBe(cartPanel);
  expect(cartPanel.compareDocumentPosition(productsPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByTestId('panel-position-right').getAttribute('aria-selected')).toBe('true');
});

test('narrow screens keep the stacked layout whatever the position', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"position":"right"}');
  render(<><SaleScreen {...props} /><PortalHost /></>);
  expect(screen.queryByTestId('pos-products-panel')).toBeNull();
  expect(screen.queryByTestId('pos-cart-panel')).toBeNull();
});
