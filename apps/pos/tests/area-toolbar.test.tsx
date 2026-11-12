import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { StoreOrder } from '@tallyui/core';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { PortalHost } from '@tallyui/primitives';
import { Text } from '@tallyui/components';
import { AppRailShown } from '../components/app-rail';
import { AreaToolbar } from '../components/area-header';
import { CouponsScreen } from '../components/coupons-screen';
import { CustomersScreen } from '../components/customers-screen';
import { OrdersScreen } from '../components/orders-screen';
import { ProductsScreen } from '../components/products-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { classesOf } from './classes-of';

const connector = createWooCommerceConnector();
let db: Awaited<ReturnType<typeof createTallyDatabase>>;

beforeEach(async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Shop', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  db = await createTallyDatabase({ connector, name: `area_toolbar_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.close();
});

function renderArea(screenUnderTest: ReactNode, rail = true) {
  return render(<SessionProvider>
    <OutboxProvider transportFor={() => ({ send: vi.fn() })} storage={getRxStorageMemory()}>
      <AppRailShown.Provider value={rail}>{screenUnderTest}</AppRailShown.Provider><PortalHost />
    </OutboxProvider>
  </SessionProvider>);
}

const areas: [string, () => ReactNode][] = [
  ['orders', () => <OrdersScreen onBack={vi.fn()} history={{ list: async () => ({ orders: [], hasMore: false }) }} storeName="Shop" cashierName="Paul" />],
  ['customers', () => <CustomersScreen source={{ search: async () => [], create: vi.fn() }} onBack={vi.fn()} createBlockedReason={undefined} />],
  ['products', () => <ProductsScreen products={[]} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />],
  ['coupons', () => <CouponsScreen coupons={db.coupons} currency="USD" locale="en_US" onBack={vi.fn()} />],
];

test.each(areas)("at 1280 the %s toolbar is v2's: the search, then the bell and the avatar at the right", async (area, make) => {
  renderArea(make());
  const search = await screen.findByTestId(`search-${area}`);
  expect(screen.getByTestId(`${area}-bar-search`).contains(search)).toBe(true);
  expect(classesOf(`${area}-bar-search`)).toContain('max-w-160');
  const controls = screen.getByTestId(`${area}-bar-controls`);
  expect(controls.contains(screen.getByTestId(`${area}-bar-bell`))).toBe(true);
  expect(controls.contains(screen.getByTestId(`${area}-bar-avatar`))).toBe(true);
  expect(screen.queryByTestId(`${area}-back`)).toBeNull();
});

test("the Customers cluster runs as v2's: add customer, then the bell, then the avatar, which opens the cashier sheet", async () => {
  renderArea(areas[1][1]());
  await screen.findByTestId('search-customers');
  const order = Array.from(screen.getByTestId('customers-bar-controls').querySelectorAll('[data-testid]'))
    .map(el => el.getAttribute('data-testid'))
    .filter(id => ['customers-add-button', 'customers-bar-bell', 'customers-bar-avatar'].includes(id!));
  expect(order).toEqual(['customers-add-button', 'customers-bar-bell', 'customers-bar-avatar']);
  expect(screen.getByTestId('customers-bar-avatar').textContent).toContain('P');
});

test("on a phone the title row carries the cluster and Back, and the search takes its own row, as v2's phone bar", async () => {
  renderArea(areas[3][1](), false);
  const search = await screen.findByTestId('search-coupons');
  expect(screen.getByTestId('coupons-bar-controls').contains(search)).toBe(false);
  expect(screen.getByTestId('coupons-bar-bell')).not.toBeNull();
  expect(screen.getByTestId('coupons-back')).not.toBeNull();
  expect(classesOf('coupons-bar-search')).not.toContain('max-w-160');
});

test.each([true, false])("a title slot is drawn before the controls (rail shown: %s), as v2's PageBar titleSlot", rail => {
  renderArea(<AreaToolbar area="scoped" title="Scoped" onBack={vi.fn()} titleSlot={<Text testID="scoped-title">Shop · Till</Text>} />, rail);
  const slot = screen.getByTestId('scoped-bar-title-slot');
  expect(slot.contains(screen.getByTestId('scoped-title'))).toBe(true);
  expect(screen.getByTestId('scoped-bar').contains(slot)).toBe(true);
  // With the rail the slot opens the row; with none the title row (title, controls, Back) comes first.
  const controls = screen.getByTestId('scoped-bar-controls');
  expect(slot.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(rail ? Node.DOCUMENT_POSITION_FOLLOWING : 0);
  expect(screen.queryByTestId('scoped-back') === null).toBe(rail);
});

test("seven coupons with five matching the search read v2's Showing 5 of 7, beside the sync button", async () => {
  await db.coupons.bulkInsert(Array.from({ length: 7 }, (_, i) => ({ uuid: `c-${i}`, id: i + 1,
    code: i < 5 ? `save${i}` : `other${i}`, discount_type: 'percent', amount: '5', used_by: [], status: 'publish' })));
  renderArea(areas[3][1]());
  await waitFor(() => expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 7 of 7'));
  fireEvent.change(screen.getByTestId('search-coupons'), { target: { value: 'save' } });
  await waitFor(() => expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 5 of 7'));
  expect(screen.getByTestId('data-table-caption-row').contains(screen.getByTestId('data-table-sync'))).toBe(true);
  expect(screen.getByTestId('data-table-sync').getAttribute('aria-label')).toBe('Sync');
});

// v2's page gutter (ground.ts:46-72): 12 px in a window, 16 on a phone, on every area's bar, card and own rows.
const order = { id: '901', reference: '901', status: 'completed', placedAt: new Date().toISOString(), currency: 'USD',
  pricesIncludeTax: false, customer: null, lines: [], fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [], discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600 } as unknown as StoreOrder;
const gutterAreas: [string, () => ReactNode, string | null][] = [
  ['orders', () => <OrdersScreen onBack={vi.fn()} history={{ list: async () => ({ orders: [order], hasMore: false }) }} storeName="Shop" cashierName="Paul" />, null],
  ['customers', () => <CustomersScreen source={{ search: async () => [], create: vi.fn() }} onBack={vi.fn()} createBlockedReason="No" />, 'customers-add-blocked'],
  ['products', areas[2][1], 'products-filter-row'],
  ['coupons', areas[3][1], 'coupons-filter-row'],
];
test.each(gutterAreas)("the %s bar, card and rows sit on v2's 12 px gutter in a window and 16 on a phone", async (area, make, row) => {
  renderArea(make());
  await screen.findByTestId(`${area}-table-surface`);
  expect(classesOf(`${area}-bar`)).toContain('px-3');
  expect(classesOf(`${area}-bar`)).not.toContain('px-4');
  expect(classesOf(`${area}-table-surface`)).toContain('mx-3');
  if (row) expect(classesOf(row)).toContain('px-3');
  cleanup();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  renderArea(make(), false);
  await screen.findByTestId(`${area}-table-surface`);
  expect(classesOf(`${area}-bar-search-row`)).toContain('px-4');
  expect(classesOf(`${area}-table-surface`)).not.toContain('mx-3');
  if (row) expect(classesOf(row)).toContain('px-4');
});
