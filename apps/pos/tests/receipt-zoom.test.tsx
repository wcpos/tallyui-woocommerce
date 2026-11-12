import { setLineQuantity } from './cart-line-helpers';
import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { Text } from '@tallyui/components';
import type { OrderCreateEnvelope, StoreOrder } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { ReceiptPrintSheet } from '../components/receipt-print-sheet';
import { ReceiptZoom } from '../components/receipt-zoom';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';
import { receiptPrintCss } from '../lib/receipts/print-receipt';
import { MAX_PREVIEW_ZOOM, MIN_PREVIEW_ZOOM, PAPER_DIMENSIONS, PREVIEW_ZOOM_STEPS, pickAutoFitZoom, stepPreviewZoom } from '../lib/receipts/receipt-zoom';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

const props: ComponentProps<typeof SaleScreen> = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function setup(send: CommandTransport<OrderCreateEnvelope>['send'], history: OrderHistorySource | null = null) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} multiplePayments />
        <OrdersScreen onBack={() => {}} history={history} storeName={props.storeName} cashierName={props.cashierName} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
}

const applied = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'applied' as const,
  serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } });

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};

type LayoutNode = HTMLElement & {
  __reactLayoutHandler: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
};
// RNW attaches onLayout to the node; jsdom has no ResizeObserver, so the test reports the size.
const layout = (testId: string, width: number, height = 0) => act(() => {
  (screen.getByTestId(testId) as LayoutNode).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
});
const value = () => screen.getByTestId('receipt-preview-zoom-value').textContent;
const zoomIn = () => screen.getByRole('button', { name: 'Zoom in' });
const zoomOut = () => screen.getByRole('button', { name: 'Zoom out' });
const px = (el: HTMLElement, prop: 'width' | 'height') => parseFloat(el.style[prop]);

const renderZoom = () => render(<ReceiptZoom><Text>Receipt body</Text></ReceiptZoom>);

test('pickAutoFitZoom fills the width with a whole percent inside 10 to 200', () => {
  expect(pickAutoFitZoom(302, 302)).toBe(100);
  expect(pickAutoFitZoom(302, 151)).toBe(50);
  expect(pickAutoFitZoom(302, 226)).toBe(74);
  expect(pickAutoFitZoom(302, 974)).toBe(200);
  expect(pickAutoFitZoom(302, 20)).toBe(10);
  expect(pickAutoFitZoom(302, 0)).toBe(100);
  expect(pickAutoFitZoom(0, 300)).toBe(100);
});

test('stepPreviewZoom steps from a fit that is no step and stops at the ends', () => {
  expect(stepPreviewZoom(74, 1)).toBe(80);
  expect(stepPreviewZoom(74, -1)).toBe(70);
  expect(stepPreviewZoom(80, 1)).toBe(90);
  expect(stepPreviewZoom(80, -1)).toBe(70);
  expect(stepPreviewZoom(200, 1)).toBe(200);
  expect(stepPreviewZoom(10, -1)).toBe(10);
});

test("the steps and paper sizes are v2's", () => {
  expect(PREVIEW_ZOOM_STEPS).toHaveLength(20);
  expect(PREVIEW_ZOOM_STEPS[0]).toBe(10);
  expect(PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1]).toBe(200);
  expect(MIN_PREVIEW_ZOOM).toBe(10);
  expect(MAX_PREVIEW_ZOOM).toBe(200);
  expect(PAPER_DIMENSIONS['80mm']).toEqual({ width: 302, height: 520 });
  expect(PAPER_DIMENSIONS['58mm']).toEqual({ width: 219, height: 520 });
});

test('shows the receipt at 100% on an 80 mm canvas until the pane is measured', () => {
  renderZoom();
  expect(value()).toBe('100%');
  const canvas = screen.getByTestId('receipt-preview-canvas');
  expect(within(canvas).getByText('Receipt body')).not.toBeNull();
  expect(canvas.style.width).toBe('302px');
  expect(canvas.style.transform).toBe('scale(1)');
  expect(canvas.style.transformOrigin).toContain('top');
  expect(canvas.style.transformOrigin).toContain('left');
  const frame = screen.getByTestId('receipt-preview-canvas-frame');
  expect(px(frame, 'width')).toBe(302);
  expect(px(frame, 'height')).toBe(520);
});

test('fills the measured pane width, and the measured receipt height sizes the frame', () => {
  renderZoom();
  layout('receipt-preview', 177);
  expect(value()).toBe('50%');
  expect(screen.getByTestId('receipt-preview-canvas').style.transform).toBe('scale(0.5)');
  layout('receipt-preview-canvas', 302, 900);
  const frame = screen.getByTestId('receipt-preview-canvas-frame');
  expect(px(frame, 'width')).toBe(151);
  expect(px(frame, 'height')).toBe(450);
});

test('Zoom in and Zoom out step from the fit, and a picked zoom holds through a resize', () => {
  renderZoom();
  layout('receipt-preview', 252);
  expect(value()).toBe('74%');
  const frame = () => screen.getByTestId('receipt-preview-canvas-frame');
  expect(px(frame(), 'width')).toBeCloseTo(223.48, 1);
  fireEvent.click(zoomIn());
  expect(value()).toBe('80%');
  expect(px(frame(), 'width')).toBeCloseTo(241.6, 1);
  fireEvent.click(zoomOut());
  fireEvent.click(zoomOut());
  expect(value()).toBe('60%');
  layout('receipt-preview', 1000);
  expect(value()).toBe('60%');
});

test('a wide pane fits up to 200%, where Zoom in is disabled', () => {
  renderZoom();
  layout('receipt-preview', 1000);
  expect(value()).toBe('200%');
  expect(zoomIn().getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(zoomIn());
  expect(value()).toBe('200%');
  expect(zoomOut().getAttribute('aria-disabled')).not.toBe('true');
});

test('Zoom out stops at 10% and is then disabled', () => {
  renderZoom();
  for (let i = 0; i < 20; i++) fireEvent.click(zoomOut());
  expect(value()).toBe('10%');
  expect(zoomOut().getAttribute('aria-disabled')).toBe('true');
  expect(zoomIn().getAttribute('aria-disabled')).not.toBe('true');
});

test('58 mm paper uses its own width', () => {
  render(<ReceiptZoom paperWidth="58mm"><Text>Receipt body</Text></ReceiptZoom>);
  expect(screen.getByTestId('receipt-preview-canvas').style.width).toBe('219px');
  layout('receipt-preview', 245);
  expect(value()).toBe('100%');
});

test('the zoom sits outside the print area, so the print CSS resets its scale and hides its controls', () => {
  render(<ReceiptZoom><ReceiptPrintSheet orderId={null}><Text>Body</Text></ReceiptPrintSheet></ReceiptZoom>);
  const canvas = screen.getByTestId('receipt-preview-canvas');
  const area = screen.getByTestId('receipt-print-area');
  const controls = screen.getByTestId('receipt-preview-zoom-controls');
  expect(canvas.contains(area)).toBe(true);
  expect(area.contains(controls)).toBe(false);
  expect(controls.getAttribute('data-print')).toBe('hide');
  const css = receiptPrintCss('80mm', 'receipt-x');
  expect(css).toContain('transform: none !important');
  expect(css).toContain('height: auto !important');
  expect(css).toContain('overflow: visible !important');
});

test('the sale receipt stage shows its print area inside the zoom preview', async () => {
  const send: CommandTransport<OrderCreateEnvelope>['send'] = async batch => ({ kind: 'results',
    results: batch.map(e => ({ id: e.id, status: 'applied' as const, serverRefs: { orderId: '115', totalMinor: 600 } })) });
  await setup(send);
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
  const area = screen.getByTestId('receipt-print-area');
  expect(screen.getByTestId('receipt-preview-canvas').contains(area)).toBe(true);
  expect(within(area).getByTestId('receipt-order')).not.toBeNull();
  expect(area.contains(screen.getByTestId('receipt-preview-zoom-controls'))).toBe(false);
  expect(value()).toBe('100%');
  fireEvent.click(zoomIn());
  expect(value()).toBe('110%');
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  expect(screen.queryByTestId('receipt-preview')).toBeNull();
}, 20_000);

test('an Orders reprint shows the receipt inside the zoom preview', async () => {
  const list = vi.fn<OrderHistorySource['list']>(async () => ({ orders: [storeOrder], hasMore: false }));
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  fireEvent.click(screen.getByTestId(`history-open-${storeOrder.id}`));
  expect(screen.queryByTestId('receipt-preview')).toBeNull();
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  const area = screen.getByTestId('receipt-print-area');
  expect(screen.getByTestId('receipt-preview-canvas').contains(area)).toBe(true);
  expect(within(area).getByTestId('receipt-order').textContent).toBe('Order 901');
  fireEvent.click(screen.getAllByRole('button', { name: 'Back' }).find(b => b.getAttribute('data-testid') !== 'orders-back')!);
  expect(screen.queryByTestId('receipt-preview')).toBeNull();
}, 20_000);
