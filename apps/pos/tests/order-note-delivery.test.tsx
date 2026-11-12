import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import * as CatalogueContext from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
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
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function takeCash(minor: number): Promise<void> {
  await screen.findByTestId('checkout-keypad');
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of String(minor)) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('checkout-commit'));
}

test.each([
  { name: 'the note is sent', orderCreate: 8, note: 'Leave at the door' },
  { name: 'no capability, no note', orderCreate: undefined, note: 'Leave at the door' },
  { name: 'no note, no key', orderCreate: 8, note: undefined },
])('$name', async ({ orderCreate, note }) => {
  vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({
    catalogue: orderCreate === undefined ? null : { capabilities: { orderCreate } } as Catalogue,
    products, status: 'ready',
  });
  const fetchStub = vi.fn<typeof fetch>(async () => Response.json({
    document: { id: 115, status: 'completed', total: '3.000000' }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  if (note) {
    fireEvent.click(screen.getByTestId('cart-foot-more'));
    fireEvent.click(within(screen.getByTestId('cart-foot-menu')).getByRole('menuitem', { name: 'Order details' }));
    fireEvent.change(screen.getByLabelText('Customer Note'), { target: { value: note } });
    fireEvent.click(screen.getByTestId('order-details-close'));
  }
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  if (orderCreate === 8 && note) {
    expect(payload.customer_note).toBe('Leave at the door');
    expect(screen.queryByText("The customer note couldn't be sent to the store.")).toBeNull();
  } else {
    if (note) expect(await screen.findByText("The customer note couldn't be sent to the store.")).toBeTruthy();
    else expect(screen.queryByText("The customer note couldn't be sent to the store.")).toBeNull();
    expect(payload).not.toHaveProperty('customer_note');
  }
}, 20_000);
