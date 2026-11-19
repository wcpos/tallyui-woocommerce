import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import * as ReactNative from 'react-native';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { CameraScannerPanelProps } from '@tallyui/components';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { cartTabCount } from './phone-tabs-helpers';

// No camera in jsdom: the panel is a fake that opens like TallyUI's (onOpen once on mount) and decodes on a press.
const CODES = ['2000000000015', '12345'];
function FakeCameraScannerPanel({ onClose, onDetected, onOpen }: CameraScannerPanelProps) {
  useEffect(() => { onOpen?.(); }, []);
  return <View testID="camera-scanner-panel">
    {CODES.map(code => <Pressable key={code} testID={`fake-decode-${code}`} onPress={() => onDetected(code, 'ean13')} />)}
    <Pressable testID="fake-close" onPress={onClose} />
  </View>;
}
vi.mock('@tallyui/components', async importOriginal => ({ ...await importOriginal<object>(), CameraScannerPanel: FakeCameraScannerPanel }));

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const button = () => screen.getByTestId('camera-scan-button');
const panel = () => screen.queryByTestId('camera-scanner-panel');
const decode = (code: string) => fireEvent.click(screen.getByTestId(`fake-decode-${code}`));

test('the camera scan button shows "Scan barcode with camera" and opens the panel, flipping its label to "Close barcode scanner"', () => {
  render(<SaleScreen {...props} />);
  expect(button().getAttribute('aria-label')).toBe('Scan barcode with camera');
  expect(panel()).toBeNull();
  fireEvent.click(button());
  expect(panel()).not.toBeNull();
  expect(button().getAttribute('aria-label')).toBe('Close barcode scanner');
});

test('a decoded code goes through the sale scan: a simple product\'s barcode adds it to the cart', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(button());
  decode('2000000000015');
  expect(cartTabCount()).toBe('1');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-added-to-cart', type: 'success', title: 'Espresso added to cart' })]);
  expect(panel()).not.toBeNull();
});

test('pressing the button again closes the panel', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(button());
  fireEvent.click(button());
  expect(panel()).toBeNull();
  expect(button().getAttribute('aria-label')).toBe('Scan barcode with camera');
  fireEvent.click(button());
  fireEvent.click(screen.getByTestId('fake-close'));
  expect(panel()).toBeNull();
});

test('the camera adds a code once while it stays in view, and again after the scanner reopens', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(button());
  decode('2000000000015');
  decode('2000000000015');
  expect(cartTabCount()).toBe('1');
  fireEvent.click(button());
  fireEvent.click(button());
  decode('2000000000015');
  expect(cartTabCount()).toBe('2');
});

test('a decoded code shorter than the minimum length warns with v2\'s copy and adds nothing', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(button());
  decode('12345');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-scan-alert', type: 'warning',
    title: 'Barcode scanned: 12345', description: 'Barcode must be at least 8 characters long' })]);
  expect(cartTabCount()).toBe('New');
});

// A screen pushed over the till (Orders, Products) claims the wedge after the till did.
function LaterScanner() {
  useWedgeScanner(() => {}, true);
  return null;
}
function TillUnder({ pushed }: { pushed: boolean }) {
  return <><SaleScreen {...props} />{pushed ? <LaterScanner /> : null}</>;
}

test('a decode is dropped while a later scanner owns the scan', () => {
  const { rerender } = render(<TillUnder pushed={false} />);
  fireEvent.click(button());
  rerender(<TillUnder pushed />);
  decode('2000000000015');
  expect(cartTabCount()).toBe('New');
  rerender(<TillUnder pushed={false} />);
  decode('2000000000015');
  expect(cartTabCount()).toBe('1');
});
