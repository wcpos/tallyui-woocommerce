import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

test('the default separator sits between the 60/40 panes', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  const productsPanel = screen.getByTestId('pos-products-panel');
  const cartPanel = screen.getByTestId('pos-cart-panel');
  expect(handle.getAttribute('role')).toBe('separator');
  expect(handle.getAttribute('aria-valuenow')).toBe('60');
  expect(handle.getAttribute('aria-orientation')).toBe('vertical');
  expect(handle.getAttribute('aria-label')).toBe('Resize products and cart');
  expect(handle.getAttribute('aria-valuemin')).toBe('25');
  expect(handle.getAttribute('aria-valuemax')).toBe('75');
  expect(handle.tabIndex).toBe(0);
  expect(Array.from(handle.parentElement!.children)).toEqual([productsPanel, handle, cartPanel]);
  expect(productsPanel.style.flexGrow).toBe('60');
  expect(cartPanel.style.flexGrow).toBe('40');
});

test('arrow keys resize and persist each change', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  expect(fireEvent.keyDown(handle, { key: 'ArrowRight' })).toBe(false);
  expect(handle.getAttribute('aria-valuenow')).toBe('65');
  expect(screen.getByTestId('pos-products-panel').style.flexGrow).toBe('65');
  expect(screen.getByTestId('pos-cart-panel').style.flexGrow).toBe('35');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(65);
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(handle.getAttribute('aria-valuenow')).toBe('55');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(55);
});

test('End and Home persist the maximum and minimum widths', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  fireEvent.keyDown(handle, { key: 'End' });
  expect(handle.getAttribute('aria-valuenow')).toBe('75');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(75);
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(handle.getAttribute('aria-valuenow')).toBe('25');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(25);
});

test('right-side products narrow when the handle moves right', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"position":"right"}');
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  const productsPanel = screen.getByTestId('pos-products-panel');
  const cartPanel = screen.getByTestId('pos-cart-panel');
  expect(Array.from(handle.parentElement!.children)).toEqual([cartPanel, handle, productsPanel]);
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(handle.getAttribute('aria-valuenow')).toBe('55');
  expect(productsPanel.style.flexGrow).toBe('55');
  expect(cartPanel.style.flexGrow).toBe('45');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(55);
});

test.each([[30, 30], [5, 25], ['wide', 60]])('normalizes stored width %s to %s', (stored, expected) => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ width: stored }));
  render(<><SaleScreen {...props} /><PortalHost /></>);
  expect(screen.getByTestId('pos-resize-handle').getAttribute('aria-valuenow')).toBe(String(expected));
  expect(screen.getByTestId('pos-products-panel').style.flexGrow).toBe(String(expected));
  expect(screen.getByTestId('pos-cart-panel').style.flexGrow).toBe(String(100 - Number(expected)));
});

test('restoring catalogue settings also restores the width', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  fireEvent.keyDown(screen.getByTestId('pos-resize-handle'), { key: 'ArrowRight' });
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(65);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(screen.getByTestId('pos-resize-handle').getAttribute('aria-valuenow')).toBe('60');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(60);
});

test('stacked screens have no resize handle', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen {...props} /><PortalHost /></>);
  expect(screen.queryByTestId('pos-resize-handle')).toBeNull();
});

test('other keys are not prevented and do not change or store width', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  expect(fireEvent.keyDown(handle, { key: 'a' })).toBe(true);
  expect(handle.getAttribute('aria-valuenow')).toBe('60');
  expect(screen.getByTestId('pos-products-panel').style.flexGrow).toBe('60');
  expect(screen.getByTestId('pos-cart-panel').style.flexGrow).toBe('40');
  expect(localStorage.getItem(CATALOGUE_VIEW_KEY)).toBeNull();
});

test('mouse dragging previews a fractional width and stores it only on release', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  // RNW attaches this layout callback to the row; jsdom has no ResizeObserver.
  const row = handle.parentElement as HTMLElement & {
    __reactLayoutHandler: (event: { nativeEvent: { layout: { width: number } } }) => void;
  };
  act(() => row.__reactLayoutHandler({ nativeEvent: { layout: { width: 900 } } }));
  fireEvent.mouseDown(handle, { clientX: 540, clientY: 100, buttons: 1 });
  fireEvent.mouseMove(handle, { clientX: 640, clientY: 100, buttons: 1 });
  expect(handle.getAttribute('aria-valuenow')).toBe('71');
  expect(Number(screen.getByTestId('pos-products-panel').style.flexGrow)).toBeCloseTo(60 + 100 / 9);
  expect(Number(screen.getByTestId('pos-cart-panel').style.flexGrow)).toBeCloseTo(40 - 100 / 9);
  expect(localStorage.getItem(CATALOGUE_VIEW_KEY)).toBeNull();
  fireEvent.mouseUp(handle, { clientX: 640, clientY: 100 });
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBeCloseTo(60 + 100 / 9);
});

test('two quick mouse clicks reset a stored width to 60', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"width":70}');
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  fireEvent.mouseDown(handle, { clientX: 630, clientY: 100, buttons: 1 });
  fireEvent.mouseUp(handle, { clientX: 630, clientY: 100 });
  expect(handle.getAttribute('aria-valuenow')).toBe('70');
  vi.mocked(Date.now).mockReturnValue(1100);
  fireEvent.mouseDown(handle, { clientX: 630, clientY: 100, buttons: 1 });
  fireEvent.mouseUp(handle, { clientX: 630, clientY: 100 });
  expect(handle.getAttribute('aria-valuenow')).toBe('60');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(60);
});

test('a cancelled drag drops the preview so Restore shows 60', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"width":50}');
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  const productsPanel = screen.getByTestId('pos-products-panel');
  const row = handle.parentElement as HTMLElement & {
    __reactLayoutHandler: (event: { nativeEvent: { layout: { width: number } } }) => void;
  };
  act(() => row.__reactLayoutHandler({ nativeEvent: { layout: { width: 900 } } }));
  fireEvent.mouseDown(handle, { clientX: 450, clientY: 100, buttons: 1 });
  fireEvent.mouseMove(handle, { clientX: 550, clientY: 100, buttons: 1 });
  expect(handle.getAttribute('aria-valuenow')).toBe('61');
  fireEvent.contextMenu(handle);
  expect(handle.getAttribute('aria-valuenow')).toBe('50');
  expect(productsPanel.style.flexGrow).toBe('50');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(50);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(handle.getAttribute('aria-valuenow')).toBe('60');
  expect(productsPanel.style.flexGrow).toBe('60');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(60);
});

test('a finished drag drops the preview so Restore shows 60', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  const handle = screen.getByTestId('pos-resize-handle');
  const productsPanel = screen.getByTestId('pos-products-panel');
  const row = handle.parentElement as HTMLElement & {
    __reactLayoutHandler: (event: { nativeEvent: { layout: { width: number } } }) => void;
  };
  act(() => row.__reactLayoutHandler({ nativeEvent: { layout: { width: 900 } } }));
  fireEvent.mouseDown(handle, { clientX: 540, clientY: 100, buttons: 1 });
  fireEvent.mouseMove(handle, { clientX: 640, clientY: 100, buttons: 1 });
  fireEvent.mouseUp(handle, { clientX: 640, clientY: 100 });
  expect(handle.getAttribute('aria-valuenow')).toBe('71');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBeCloseTo(60 + 100 / 9);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(handle.getAttribute('aria-valuenow')).toBe('60');
  expect(productsPanel.style.flexGrow).toBe('60');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).width).toBe(60);
});
