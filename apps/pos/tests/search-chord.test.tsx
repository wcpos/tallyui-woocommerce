import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { SaleScreen } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { noTaxSettings } from './fixtures/store-settings';
import { memoryStorage } from './memory-storage';
import { openCartTab, paneShown } from './phone-tabs-helpers';

// WCPOS v2's alt+f → pos.search.focus (hotkeys/bindings.ts:9, hotkeys.web.tsx:12-29, products/index.tsx:203-216).

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const search = () => screen.getByTestId('catalogue-search');

/** Presses a key on `target` and lets the deferred focus run; returns whether the event was prevented. */
function press(target: Element | Document, init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(event); });
  act(() => { vi.runAllTimers(); });
  return event.defaultPrevented;
}
const altF: KeyboardEventInit = { key: 'ƒ', code: 'KeyF', altKey: true };

test("alt+f focuses the catalogue search and prevents the browser's own Alt+F", () => {
  render(<CatalogueView {...props} />);
  expect(document.activeElement).not.toBe(search());
  expect(press(document.body, altF)).toBe(true);
  expect(document.activeElement).toBe(search());
});

test('alt+f works while another input has focus', () => {
  render(<><CatalogueView {...props} /><input data-testid="other" /></>);
  const other = screen.getByTestId('other');
  other.focus();
  expect(press(other, altF)).toBe(true);
  expect(document.activeElement).toBe(search());
});

test('alt+ctrl+f, meta+alt+f and plain f do nothing', () => {
  render(<CatalogueView {...props} />);
  expect(press(document.body, { ...altF, ctrlKey: true })).toBe(false);
  expect(press(document.body, { ...altF, metaKey: true })).toBe(false);
  expect(press(document.body, { key: 'f', code: 'KeyF' })).toBe(false);
  expect(document.activeElement).not.toBe(search());
});

test('a dead key inside an input does nothing', () => {
  render(<><CatalogueView {...props} /><input data-testid="other" /></>);
  const other = screen.getByTestId('other');
  other.focus();
  expect(press(other, { key: 'Dead', code: 'KeyF', altKey: true })).toBe(false);
  expect(press(other, { key: 'é', code: 'KeyF', altKey: true })).toBe(false);
  expect(document.activeElement).toBe(other);
});

test('alt+f does nothing while a dialog is open', () => {
  render(<><CatalogueView {...props} /><div role="dialog" /></>);
  expect(press(document.body, altF)).toBe(false);
  expect(document.activeElement).not.toBe(search());
});

test('an event already defaultPrevented is left alone', () => {
  render(<CatalogueView {...props} />);
  const first = (event: KeyboardEvent) => event.preventDefault();
  window.addEventListener('keydown', first, { capture: true });
  try {
    press(document.body, altF);
  } finally {
    window.removeEventListener('keydown', first, { capture: true });
  }
  expect(document.activeElement).not.toBe(search());
});

test('searchChord false switches the chord off', () => {
  render(<CatalogueView {...props} searchChord={false} />);
  expect(press(document.body, altF)).toBe(false);
  expect(document.activeElement).not.toBe(search());
});

test('after unmount alt+f does nothing', () => {
  const view = render(<CatalogueView {...props} />);
  view.unmount();
  expect(press(document.body, altF)).toBe(false);
});

const saleProps: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

function phoneTill(extra: Partial<SaleScreenProps> = {}) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  render(<><SaleScreen {...saleProps} {...extra} /><PortalHost /></>);
  openCartTab();
  expect(paneShown('cart')).toBe(true);
}

test('phone till: alt+f on the Cart tab shows Products and focuses the search', () => {
  phoneTill();
  expect(press(document.body, altF)).toBe(true);
  expect(paneShown('products')).toBe(true);
  expect(document.activeElement).toBe(search());
});

test('till not shown (searchChord false): alt+f leaves the Cart tab and is not prevented', () => {
  phoneTill({ searchChord: false });
  expect(press(document.body, altF)).toBe(false);
  expect(paneShown('cart')).toBe(true);
});

test('wide till at checkout: alt+f is off and the tender takes the catalogue column', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen {...saleProps} /><PortalHost /></>);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.queryByTestId('catalogue-search')).toBeNull();
  expect(press(document.body, altF)).toBe(false);
});
