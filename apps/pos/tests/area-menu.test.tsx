// v2's phone area bar (WCPOS monorepo packages/components/src/page-bar/index.tsx:94-112, management-bar/index.tsx:45,
// bar-controls/index.tsx:22-31): the menu button labelled "Menu" (`<bar>-menu`) opens the front drawer, then the
// title in semibold; no Back. Beside the rail there is no menu and no title row.
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { PortalHost } from '@tallyui/primitives';
import { AppFrame } from '../components/app-rail';
import { AreaToolbar } from '../components/area-header';
import { CouponsScreen } from '../components/coupons-screen';
import { CustomersScreen } from '../components/customers-screen';
import { OrdersScreen } from '../components/orders-screen';
import { ProductsScreen } from '../components/products-screen';
import { SettingsArea } from '../components/settings/settings-area';
import { SETTINGS_NAV_ITEMS } from '../components/settings/settings-navigation';
import { SupportScreen } from '../components/support-screen';
import type { RailKey } from '../lib/layout/rail-routes';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { classesOf, textPropsOf } from './classes-of';

const connector = createWooCommerceConnector();
let db: Awaited<ReturnType<typeof createTallyDatabase>>;

beforeEach(async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Shop', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  db = await createTallyDatabase({ connector, name: `area_menu_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.close();
});

function renderArea(area: RailKey, make: () => ReactNode, { wide = false, onNavigate = vi.fn() } = {}) {
  render(<SessionProvider>
    <OutboxProvider transportFor={() => ({ send: vi.fn() })} storage={getRxStorageMemory()}>
      <AppFrame wide={wide} pathname={`/${area}`} onNavigate={onNavigate}>{make()}</AppFrame><PortalHost />
    </OutboxProvider>
  </SessionProvider>);
  return onNavigate;
}

const areas: [RailKey, string, () => ReactNode][] = [
  ['products', 'Products', () => <ProductsScreen products={[]} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />],
  ['orders', 'Orders', () => <OrdersScreen onBack={vi.fn()} history={{ list: async () => ({ orders: [], hasMore: false }) }} storeName="Shop" cashierName="Paul" />],
  ['coupons', 'Coupons', () => <CouponsScreen coupons={db.coupons} currency="USD" locale="en_US" onBack={vi.fn()} />],
  ['customers', 'Customers', () => <CustomersScreen source={{ search: async () => [], create: vi.fn() }} onBack={vi.fn()} createBlockedReason={undefined} />],
  // ReportsScreen needs a register; its bar is this AreaToolbar (reports-screen.tsx).
  ['reports', 'Reports', () => <AreaToolbar area="reports" title="Reports" onBack={vi.fn()} />],
  ['support', 'Support', () => <SupportScreen onBack={vi.fn()} />],
];
const orders = areas[1];

function expectPhoneBar(area: string, title: string) {
  const menu = screen.getByTestId(`${area}-menu`);
  expect(menu.getAttribute('aria-label')).toBe('Menu');
  const heading = screen.getByRole('heading', { name: title });
  expect(menu.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(textPropsOf(heading).classes).toContain('font-semibold');
  expect(screen.queryByTestId(`${area}-back`)).toBeNull();
}

test('on a phone the Orders bar opens with v2\'s Menu button, then the title in semibold, and no Back', async () => {
  renderArea(orders[0], orders[2]);
  await screen.findByTestId('orders-menu');
  expectPhoneBar('orders', 'Orders');
  expect(classesOf('orders-menu')).toContain('-ml-2');
});

test('the Menu button opens the front drawer, with Orders selected, and Customers in it navigates to Customers', async () => {
  const onNavigate = renderArea(orders[0], orders[2]);
  const menu = await screen.findByTestId('orders-menu');
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
  fireEvent.click(menu);
  expect(screen.getByTestId('drawer-panel')).not.toBeNull();
  expect(classesOf('drawer-item-orders')).toContain('bg-rail-selected');
  expect(classesOf('drawer-item-pos')).not.toContain('bg-rail-selected');
  fireEvent.click(screen.getByTestId('drawer-item-customers'));
  expect(onNavigate).toHaveBeenCalledWith('orders', 'customers');
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
  fireEvent.click(screen.getByTestId('orders-menu'));
  fireEvent.click(screen.getByTestId('drawer-item-pos'));
  expect(onNavigate).toHaveBeenLastCalledWith('orders', 'pos');
  // The current area only closes the drawer.
  fireEvent.click(screen.getByTestId('orders-menu'));
  fireEvent.click(screen.getByTestId('drawer-item-orders'));
  expect(onNavigate).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
});

test.each(areas)('the %s phone bar draws Menu, a semibold %s, and no Back', async (area, title, make) => {
  renderArea(area, make);
  await screen.findByTestId(`${area}-menu`);
  expectPhoneBar(area, title);
});

test('beside the rail the bar has no Menu and no title row', async () => {
  renderArea(orders[0], orders[2], { wide: true });
  await screen.findByTestId('orders-bar');
  expect(screen.queryByTestId('orders-menu')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Orders' })).toBeNull();
  expect(screen.queryByTestId('orders-back')).toBeNull();
});

// v2's phone area index (navigation-area/index.tsx:87-99): ManagementBar `title={areaLabel}` with no `back`, so the
// Settings and Store health page lists open with the same Menu button and title as the area bars.
const HEALTH_ITEMS = [{ href: '/health/database', label: 'Database', testID: 'health-nav-database' },
  { href: '/health/logs', label: 'Logs', testID: 'health-nav-logs' }];
const settingsIndex = () => <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref="/settings" wide={false}
  onNavigate={vi.fn()} onBack={vi.fn()} onIndex={vi.fn()}>{null}</SettingsArea>;

test('on a phone the Settings page list opens with Menu, then the title Settings, and no Back', async () => {
  renderArea('settings', settingsIndex);
  await screen.findByTestId('settings-menu');
  expectPhoneBar('settings', 'Settings');
  expect(classesOf('settings-menu')).toContain('-ml-2');
  expect(screen.getByTestId('settings-nav-general')).not.toBeNull();
});

test('the Settings page list Menu opens the drawer with Settings selected, and Orders in it navigates to Orders', async () => {
  const onNavigate = renderArea('settings', settingsIndex);
  const menu = await screen.findByTestId('settings-menu');
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
  fireEvent.click(menu);
  expect(screen.getByTestId('drawer-panel')).not.toBeNull();
  expect(classesOf('drawer-item-settings')).toContain('bg-rail-selected');
  expect(classesOf('drawer-item-orders')).not.toContain('bg-rail-selected');
  fireEvent.click(screen.getByTestId('drawer-item-orders'));
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('settings', 'orders');
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
});

test('on a phone the Store health page list opens with Menu, then the title Store health, and no Back', async () => {
  renderArea('health', () => <SettingsArea items={HEALTH_ITEMS} currentHref="/health" wide={false} title="Store health"
    testIDPrefix="health" onNavigate={vi.fn()} onBack={vi.fn()} onIndex={vi.fn()}>{null}</SettingsArea>);
  await screen.findByTestId('health-menu');
  expectPhoneBar('health', 'Store health');
  expect(screen.getByTestId('health-nav-logs')).not.toBeNull();
});
