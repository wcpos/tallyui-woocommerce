import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { cartTabCount } from './phone-tabs-helpers';

// v2 packages/core/src/screens/main/pos/products/use-barcode.ts:115-117: "The POS section owns scans (#1438 ruling)",
// useBarcodeDetection({ isActive: posSectionActive }). The web stack keeps the till mounted (display none) under a
// pushed screen, so the till claims the wedge only while its route shows (app/catalogue.tsx passes scanActive).

const ESPRESSO = '2000000000015';

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

function width(value: number) {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: value, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The screen pushed over the till (Settings > Barcode Scanning, Products, Orders): it claims the wedge itself. */
function Area({ onScan }: { onScan(code: string): void }) {
  useWedgeScanner(onScan, true);
  return null;
}

function wedge(code: string) {
  vi.useFakeTimers();
  try {
    act(() => {
      for (const key of [...code, 'Enter']) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        vi.advanceTimersByTime(5);
      }
    });
  } finally {
    vi.useRealTimers();
  }
}

test('a remount across the split width under a pushed screen does not take the wedge back', () => {
  width(1000);
  const area = vi.fn();
  const view = render(<><SaleScreen {...props} scanActive={false} /><Area onScan={area} /><PortalHost /></>);
  expect(screen.queryByTestId('pos-pane-products')).toBeNull();
  // Crossing 900 px moves the catalogue from the split's products panel into the phone pane: it remounts.
  width(600);
  view.rerender(<><SaleScreen {...props} scanActive={false} /><Area onScan={area} /><PortalHost /></>);
  expect(screen.getByTestId('pos-pane-products')).not.toBeNull();
  wedge(ESPRESSO);
  expect(area.mock.calls).toEqual([[ESPRESSO]]);
  expect(cartTabCount()).toBe('New');
});

test('while the till route shows, a scan rings up on the till', () => {
  render(<><SaleScreen {...props} scanActive={true} /><PortalHost /></>);
  wedge(ESPRESSO);
  expect(cartTabCount()).toBe('1');
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test('the split-tender claim stays off while the till is hidden', async () => {
  width(900);
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const area = vi.fn();
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <Area onScan={area} />
        <OrderStoreReady />
        <SaleScreen {...props} multiplePayments={true} scanActive={false} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  // Checkout starts the two-pane tender: its claim would push on top of the Area's here.
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.getByTestId('checkout-ledger-column')).not.toBeNull();
  wedge(ESPRESSO);
  expect(area.mock.calls).toEqual([[ESPRESSO]]);
  expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$3.00');
});

test('returning to the till gives it the wedge back once the pushed screen unmounts', () => {
  const area = vi.fn();
  const view = render(<><SaleScreen {...props} scanActive={false} /><Area onScan={area} /><PortalHost /></>);
  view.rerender(<><SaleScreen {...props} scanActive={true} /><PortalHost /></>);
  wedge(ESPRESSO);
  expect(area).not.toHaveBeenCalled();
  expect(cartTabCount()).toBe('1');
});
