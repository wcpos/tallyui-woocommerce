import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope, ReceiptTemplate } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { StoreReceipt } from '../components/store-receipt';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { receiptPageCss, RECEIPT_PAGE_CSS } from '../lib/receipts/print-receipt';
import { receiptPaperWidth } from '../lib/receipts/store-receipt';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

// v2: the preview and the print take the selected template's paper (receipt-preview-viewport-utils.ts:18-37,
// use-receipt-document.ts:202-220, printer/src/print-html.ts:1-32).
const thermal = (id: string, paper?: '58mm' | '80mm'): ReceiptTemplate => ({ id, kind: 'receipt', title: id, engine: 'thermal',
  ...(paper ? { paper } : {}), dataModel: 'wcpos', body: `<receipt>${id.toUpperCase()}-MARKER</receipt>` });
const thermal58 = thermal('t58', '58mm');
const thermal80 = thermal('t80', '80mm');
const html: ReceiptTemplate = { id: 'a4', kind: 'receipt', title: 'a4', engine: 'html', dataModel: 'wcpos', body: '<p>A4-MARKER</p>' };

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function sellEspresso(templates: ReceiptTemplate[]) {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async () => ({ kind: 'retry', reason: 'network' }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} connector={{ ...createWooCommerceConnector(), receiptTemplates: async () => templates }} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
}

const printStyle = (paper: string) => document.head.querySelector<HTMLStyleElement>(`style[data-receipt-print="${paper}"]`);
const canvasWidth = () => screen.getByTestId('receipt-preview-canvas').style.width;

test('receiptPaperWidth maps the template as v2 getReceiptPreviewPaperWidth', () => {
  expect(receiptPaperWidth(null)).toBe('80mm');
  expect(receiptPaperWidth(thermal58)).toBe('58mm');
  expect(receiptPaperWidth(thermal80)).toBe('80mm');
  expect(receiptPaperWidth(thermal('bare'))).toBe('80mm');
  expect(receiptPaperWidth(html)).toBe('a4');
  expect(receiptPageCss('a4')).toBe('@page { size: A4; margin: 0; }');
  expect(receiptPageCss('58mm')).toBe(RECEIPT_PAGE_CSS);
  expect(receiptPageCss('80mm')).toBe(RECEIPT_PAGE_CSS);
});

test('a 58 mm thermal template prints at 58 mm and previews on the 58 mm canvas', async () => {
  await sellEspresso([thermal58]);
  await waitFor(() => expect(screen.getByTestId('store-receipt-frame').getAttribute('srcdoc')).toContain('T58-MARKER'));
  await waitFor(() => expect(printStyle('58mm')?.textContent).toContain('width: 58mm !important'));
  expect(printStyle('80mm')).toBeNull();
  expect(canvasWidth()).toBe('219px');
}, 20_000);

test('an 80 mm thermal template keeps 80 mm', async () => {
  await sellEspresso([thermal80]);
  await screen.findByTestId('store-receipt-frame');
  await waitFor(() => expect(printStyle('80mm')?.textContent).toContain('width: 80mm !important'));
  expect(printStyle('58mm')).toBeNull();
  expect(canvasWidth()).toBe('302px');
}, 20_000);

test('the built-in receipt keeps 80 mm', async () => {
  await sellEspresso([]);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(printStyle('80mm')).not.toBeNull());
  expect(printStyle('58mm')).toBeNull();
  expect(printStyle('a4')).toBeNull();
  expect(canvasWidth()).toBe('302px');
}, 20_000);

test("picking another template changes the print width to the picked template's", async () => {
  await sellEspresso([thermal58, thermal80]);
  await screen.findByTestId('store-receipt-frame');
  await waitFor(() => expect(printStyle('58mm')).not.toBeNull());
  expect(canvasWidth()).toBe('219px');
  fireEvent.click(screen.getByTestId('receipt-template-select'));
  fireEvent.click(screen.getByTestId('receipt-template-t80'));
  await waitFor(() => expect(printStyle('80mm')?.textContent).toContain('width: 80mm !important'));
  expect(printStyle('58mm')).toBeNull();
  expect(canvasWidth()).toBe('302px');
}, 20_000);

test('an html template previews and prints on A4, as v2', async () => {
  await sellEspresso([html]);
  await screen.findByTestId('store-receipt-frame');
  await waitFor(() => expect(printStyle('a4')?.textContent).toContain('width: 210mm !important'));
  expect(printStyle('80mm')).toBeNull();
  expect(canvasWidth()).toBe('794px');
  act(() => { window.dispatchEvent(new Event('beforeprint')); });
  expect(document.head.querySelector('style[data-receipt-page]')?.textContent).toBe('@page { size: A4; margin: 0; }');
  act(() => { window.dispatchEvent(new Event('afterprint')); });
}, 20_000);

test('a frame resized while its document loads does not throw', () => {
  let onResize: (() => void) | undefined;
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { onResize = cb; } observe() {} unobserve() {} disconnect() {} });
  render(<StoreReceipt html="<p>Receipt</p>" doneLabel="New sale" onDone={() => {}} onLoad={() => {}} />);
  Object.defineProperty(screen.getByTestId('store-receipt-frame'), 'contentDocument', { value: { documentElement: null } });
  expect(onResize).toBeDefined();
  expect(() => onResize!()).not.toThrow();
});
