// H4b (e, h): the app's own money displays read the store's money format, as v2's hooks/use-currency-format.tsx:21-60
// does: the tender pane, a product tile and an open-order tab. Only money in the store's currency takes it; v2
// formats an order in another currency with that currency's own symbol.
import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { MoneyFormatProvider, type MoneyFormat, type ProductTraits, type StoreOrder } from '@tallyui/core';
import type { CatalogueEntry } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { OpenOrderTabs } from '../components/open-order-tabs';
import { OrdersScreen } from '../components/orders-screen';
import { VariantChooser } from '../components/variant-chooser';
import { VariationPicker } from '../components/variation-picker';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { OnlineStatusContext } from '../lib/online/online-status';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { StoreMoneyContext, type StoreMoney } from '../lib/money/store-money';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

// The dev store's proof format: right_space, '.' thousands, ',' decimals, on the fixtures' own currency (USD, '$').
const DOLLAR_COMMA: MoneyFormat = { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '$' };
const EURO: MoneyFormat = { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '€' };
const EUR_STORE: StoreMoney = { currency: 'EUR', format: EURO };

// What StoreSettingsProvider hands down: the same format to core's provider (the components) and the app's own.
function Store({ money, children }: { money: StoreMoney; children: ReactNode }) {
  return (
    <MoneyFormatProvider format={money.format}>
      <StoreMoneyContext.Provider value={money}>{children}</StoreMoneyContext.Provider>
    </MoneyFormatProvider>
  );
}

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
    <Store money={{ currency: stores[0].currency, format: DOLLAR_COMMA }}>
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
    </Store>,
  );
  await screen.findByText('Order store ready');
  // Espresso is product 80 at 3.00.
  expect(text('tile-price-80')).toBe('3,00 $');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
  expect(text('checkout-ledger-balance')).toBe('3,00 $');
  expect(text('checkout-ledger-totals')).toBe('Total3,00 $Paid0,00 $Remaining3,00 $');
  expect(text('checkout-commit')).toMatch(/^Take 3,00 \$ in Cash/);
  expect(send).not.toHaveBeenCalled();
}, 20_000);

const tabs = (currency: string) => (
  <OpenOrderTabs currency={currency} onSelect={async () => null} onNew={async () => null} onError={() => {}}
    now={() => Date.parse('2026-11-10T10:10:00.000Z')}
    parked={[{ id: 'a', parkedAt: '2026-11-10T10:05:00.000Z', totalMinor: 123456, lines: [{ name: 'Espresso' }] }]}
    current={{ id: 'current', lineItems: [{ name: 'Espresso' }], customer: null, totalMinor: 1250 }} />
);

test('(e) an open-order tab total reads the store format, thousands included', () => {
  render(<Store money={EUR_STORE}>{tabs('EUR')}</Store>);
  expect(text('open-order-tab-a-amount')).toBe('1.234,56 €');
  expect(text('open-order-tab-current-amount')).toBe('12,50 €');
});

test('(h) an open-order tab in another currency reads Intl\'s string for that currency, not the store\'s symbol', () => {
  render(<Store money={EUR_STORE}>{tabs('USD')}</Store>);
  expect(text('open-order-tab-a-amount')).toBe('$1,234.56');
  expect(text('open-order-tab-current-amount')).toBe('$12.50');
  expect(screen.queryByText(/€/)).toBeNull();
});

// (l) @tallyui/components' Receipt reads core's provider, which applies its format to any currency; the Orders
// screen scopes it to the order's own currency (StoreMoneyFor), so a USD order on a EUR store prints as main did.
const espressoOrder = (currency: string): StoreOrder => ({
  id: '901', reference: '901', status: 'completed', placedAt: '2026-11-10T10:00:00.000Z',
  currency, pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 1, subtotalMinor: 1250, subtotalTaxMinor: 0, totalMinor: 1250, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 1250 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 1250,
});

async function openOrdersReceipt(order: StoreOrder) {
  render(
    <Store money={EUR_STORE}>
      <SessionProvider>
        <OutboxProvider transportFor={() => ({ send: vi.fn() })} storage={getRxStorageMemory()}>
          <OrdersScreen onBack={() => {}} history={{ list: async () => ({ orders: [order], hasMore: false }) }} storeName="Shop" cashierName="Paul" />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </Store>,
  );
  fireEvent.click(await screen.findByTestId(`history-open-${order.id}`));
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  return screen.getByTestId('receipt-print-area').textContent ?? '';
}

test('(l) a USD order\'s receipt on the Orders screen under a EUR store reads Intl\'s $12.50, with no €', async () => {
  const receipt = await openOrdersReceipt(espressoOrder('USD'));
  expect(receipt).toContain('$12.50');
  expect(receipt).not.toContain('€');
});

// (n) The pickers read the variant's price in the store's format, as the tile does (not variantPriceLabel's Intl).
const shirtS: CatalogueEntry<unknown> = {
  product: {},
  variant: { id: '7', title: 'S', options: { Size: 'S' }, prices: [{ kind: 'base', amount: 1250, currency: 'EUR' }], stock: { status: 'in_stock' } },
};

test('(n) the variation picker\'s Add to Cart under a EUR store reads 12,50 €', () => {
  render(<Store money={EUR_STORE}>
    <VariationPicker entries={[shirtS]} groups={[{ name: 'Size', values: ['S'] }]} currency="EUR"
      traits={{ getName: () => 'T-Shirt' } as unknown as ProductTraits<any>} onSelect={() => {}} onClose={() => {}} />
  </Store>);
  expect(text('variation-popover-add-to-cart')).toBe('Add to Cart: 12,50 €');
});

test('(n) the flat variant chooser under a EUR store reads 12,50 €', () => {
  render(<Store money={EUR_STORE}>
    <VariantChooser entries={[shirtS]} currency="EUR" traits={{} as ProductTraits<any>} onSelect={() => {}} onClose={() => {}} />
  </Store>);
  expect(screen.getByText('12,50 €')).not.toBeNull();
});

test('(l) the same receipt in the store\'s EUR reads the store format, 12,50 €', async () => {
  const receipt = await openOrdersReceipt(espressoOrder('EUR'));
  expect(receipt).toMatch(/12,50\s€/);
  expect(receipt).not.toContain('$');
});
