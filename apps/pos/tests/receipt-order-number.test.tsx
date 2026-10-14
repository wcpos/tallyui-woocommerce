import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

function SaleScreen(props: ComponentProps<typeof SaleScreenWithoutHost>) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const props: ComponentProps<typeof SaleScreenWithoutHost> = {
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test.each([
  { name: 'receipt shows only the local reference before the push lands', applied: false },
  { name: 'receipt adds the WooCommerce number once the push is applied', applied: true },
])('$name', async ({ applied }) => {
  let sync!: () => void;
  const synced = new Promise<void>(resolve => { sync = resolve; });
  const transport: CommandTransport<OrderCreateEnvelope> = { send: vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => {
    await synced;
    return { kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied',
      serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } })) };
  }) };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => transport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = screen.getByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '3.00' } });
  fireEvent.click(complete);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
  const label = screen.getByTestId('receipt-order').textContent!;
  const last8 = label.slice(-8);
  expect(label).toMatch(/^Order [a-f0-9]{8}$/);
  expect(label).toBe(`Order ${last8}`);
  expect(label).not.toContain('#');
  await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
  if (applied) {
    await act(async () => { sync(); });
    await vi.waitFor(() => expect(screen.getByTestId('receipt-order').textContent).toBe(`Order ${last8} · #305`));
    expect(screen.getByRole('button', { name: 'New sale' })).not.toBeNull();
  }
}, 20_000);
