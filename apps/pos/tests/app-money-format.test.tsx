// H4b part 2 (e): the app's own money displays read the store's money format from the provider, as v2's
// hooks/use-currency-format.tsx:21-60 does: the tender pane, a product tile and an open-order tab.
import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { MoneyFormatProvider, type MoneyFormat } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { OpenOrderTabs } from '../components/open-order-tabs';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { OnlineStatusContext } from '../lib/online/online-status';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const EURO: MoneyFormat = { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '€' };

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
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

const text = (testId: string) => screen.getByTestId(testId).textContent;

test('(e) the product tile and the tender pane read the store format', async () => {
  const send = vi.fn(async () => ({ kind: 'results' as const, results: [] }));
  render(
    <MoneyFormatProvider format={EURO}>
      <OnlineStatusContext.Provider value={{ status: 'online-website-available' }}>
        <SessionProvider>
          <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
            <OrderStoreReady />
            <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
              products={products} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
              multiplePayments />
            <PortalHost />
          </OutboxProvider>
        </SessionProvider>
      </OnlineStatusContext.Provider>
    </MoneyFormatProvider>,
  );
  await screen.findByText('Order store ready');
  // Espresso is product 80 at 3.00.
  expect(text('tile-price-80')).toBe('3,00 €');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
  expect(text('checkout-ledger-balance')).toBe('3,00 €');
  expect(text('checkout-ledger-totals')).toBe('Total3,00 €Paid0,00 €Remaining3,00 €');
  expect(text('checkout-commit')).toMatch(/^Take 3,00 € in Cash/);
  expect(send).not.toHaveBeenCalled();
}, 20_000);

test('(e) an open-order tab total reads the store format, thousands included', () => {
  render(
    <MoneyFormatProvider format={EURO}>
      <OpenOrderTabs currency="USD" onSelect={async () => null} onNew={async () => null} onError={() => {}}
        now={() => Date.parse('2026-11-10T10:10:00.000Z')}
        parked={[{ id: 'a', parkedAt: '2026-11-10T10:05:00.000Z', totalMinor: 123456, lines: [{ name: 'Espresso' }] }]}
        current={{ id: 'current', lineItems: [{ name: 'Espresso' }], customer: null, totalMinor: 375 }} />
    </MoneyFormatProvider>,
  );
  expect(text('open-order-tab-a-amount')).toBe('1.234,56 €');
  expect(text('open-order-tab-current-amount')).toBe('3,75 €');
});
