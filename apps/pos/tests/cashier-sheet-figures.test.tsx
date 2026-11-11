import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { cashierSalesTotal, drawerFigureText, drawerVerbs } from '../lib/cashier/sheet-figures';
import { CashierSheet } from '../components/cashier-sheet';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup() {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            onSwitchCashier={async () => null} cashiers={[]} adminUrl="https://shop.example/admin-test/wp-admin" />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { get register() { return register; }, orders: outbox.orders, send };
}

const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: '2026-10-06T12:00:00.000Z', updatedAt: '2026-10-06T12:00:00.000Z',
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};

test("cashierSalesTotal counts only this cashier's sales today in the till currency", () => {
  const orders: PosOrder[] = [
    { ...base, id: 'applied', cashierRef: '2', totalMinor: 300, syncStatus: 'applied', payments: [] },
    { ...base, id: 'pending', cashierRef: '2', totalMinor: 700, syncStatus: 'pending', payments: [] },
    { ...base, id: 'rejected', cashierRef: '2', totalMinor: 100, syncStatus: 'rejected', payments: [] },
    { ...base, id: 'other', cashierRef: '3', totalMinor: 500, syncStatus: 'applied', payments: [] },
    { ...base, id: 'yesterday', cashierRef: '2', totalMinor: 900, syncStatus: 'applied', payments: [], createdAt: '2026-10-05T23:59:59.000Z' },
    { ...base, id: 'eur', cashierRef: '2', totalMinor: 400, syncStatus: 'applied', payments: [], currency: 'EUR' },
    { ...base, id: 'tomorrow', cashierRef: '2', totalMinor: 200, syncStatus: 'applied', payments: [], createdAt: '2026-10-07T00:00:00.000Z' },
  ];
  expect(cashierSalesTotal(orders, { cashierRef: '2', currency: 'USD',
    startIso: '2026-10-06T00:00:00.000Z', endIso: '2026-10-07T00:00:00.000Z' })).toEqual({ count: 2, totalMinor: 1000 });
});

test('drawerFigureText shows the expected cash while a session is open or counting', () => {
  const money = (m: number) => `$${(m / 100).toFixed(2)}`;
  expect(drawerFigureText({ enabled: true, session: { status: 'open' }, expected: { cash: 10300 } }, money)).toBe('$103.00');
  expect(drawerFigureText({ enabled: true, session: { status: 'counting' }, expected: { cash: 10300 } }, money)).toBe('$103.00');
  expect(drawerFigureText({ enabled: true, session: { status: 'open' }, expected: {} }, money)).toBe('$0.00');
});

test('drawerFigureText shows the last closure when the register is closed and nothing otherwise', () => {
  const money = (m: number) => `$${(m / 100).toFixed(2)}`;
  expect(drawerFigureText({ enabled: true, session: null, expected: {}, lastClosure: { number: 4 } }, money))
    .toBe('Register closed · last closure 4');
  expect(drawerFigureText({ enabled: true, session: { status: 'closed' }, expected: {}, lastClosure: { number: 4 } }, money))
    .toBe('Register closed · last closure 4');
  expect(drawerFigureText({ enabled: true, session: null, expected: {} }, money)).toBeUndefined();
  expect(drawerFigureText({ enabled: false, session: { status: 'open' }, expected: { cash: 10300 } }, money)).toBeUndefined();
  expect(drawerFigureText(null, money)).toBeUndefined();
});

test("drawerVerbs offers v2's drawer verbs for an open session, with who opened it and when (local time)", () => {
  const openedAt = new Date(2026, 9, 6, 14, 40).toISOString();
  const nameOf = (id: string) => id === '2' ? 'Ann' : undefined;
  expect(drawerVerbs({ session: { status: 'open', opened_at_gmt: openedAt, opened_by: '2' } }, nameOf))
    .toEqual({ verbs: 'Pay in · Pay out · Close register', opener: 'opened 14:40 by Ann' });
  expect(drawerVerbs({ session: { status: 'open', opened_at_gmt: openedAt, opened_by: '9' } }, nameOf))
    .toEqual({ verbs: 'Pay in · Pay out · Close register', opener: 'opened 14:40' });
});

test('drawerVerbs offers the last closure and opening with no session, and the way back to a count', () => {
  expect(drawerVerbs({ session: null })).toEqual({ verbs: 'Last closure · Open register' });
  expect(drawerVerbs({ session: { status: 'counting', opened_at_gmt: new Date(2026, 9, 6, 8, 0).toISOString(), opened_by: '2',
    counting_started_at_gmt: new Date(2026, 9, 6, 9, 5).toISOString() } }, () => 'Ann'))
    .toEqual({ verbs: 'Counting since 09:05 · back to the count' });
});

function hhmm(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function openSessionAndSheet() {
  const app = await setup();
  act(() => app.register.setSetting(true));
  await act(async () => { await app.register.actions.openSession({ expectedFloatMinor: 10000, countedFloatMinor: 10000 }); });
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  return app;
}

test('the drawer door names its verbs and opener, and opens the register panel (wide)', async () => {
  const app = await openSessionAndSheet();
  const door = await screen.findByTestId('user-sheet-drawer');
  expect(door.getAttribute('role')).toBe('button');
  expect(door.getAttribute('aria-label')).toBe('In the drawer, $100.00');
  expect(within(screen.getByTestId('user-sheet-drawer-verbs')).getByText('Pay in · Pay out · Close register')).not.toBeNull();
  expect(within(door).getByText(`opened ${hhmm(app.register.session!.opened_at_gmt)} by Paul`)).not.toBeNull();
  expect(screen.queryByTestId('register-panel')).toBeNull();
  fireEvent.click(door);
  await waitFor(() => expect(screen.queryByTestId('user-sheet')).toBeNull());
  expect(await screen.findByTestId('register-panel')).not.toBeNull();
}, 20_000);

test('on a narrow screen the drawer door opens the cart so the register panel shows', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  await openSessionAndSheet();
  expect(screen.queryByText('Back to products')).toBeNull();
  fireEvent.click(await screen.findByTestId('user-sheet-drawer'));
  expect(await screen.findByTestId('register-panel')).not.toBeNull();
  expect(screen.getByText('Back to products')).not.toBeNull();
}, 20_000);

test('while a payment blocks the sheet the drawer door is disabled and pressing it does nothing', () => {
  const onOpenDrawer = vi.fn();
  const sheet = (blockedReason?: string) => <><CashierSheet name="Bob Ross" cashiers={[]} onSwitch={() => {}} onAddAnother={() => {}}
    onSignOut={() => {}} drawer={{ figure: '$12.00', verbs: 'Pay in · Pay out · Close register' }} onOpenDrawer={onOpenDrawer}
    blockedReason={blockedReason} /><PortalHost /></>;
  // The avatar is disabled while blocked, so open the sheet first, then block it (the sheet keeps its open state).
  const { rerender } = render(sheet());
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  rerender(sheet('Finish or cancel the payment first.'));
  const door = screen.getByTestId('user-sheet-drawer');
  expect(door.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(door);
  expect(onOpenDrawer).not.toHaveBeenCalled();
  expect(screen.getByTestId('user-sheet')).not.toBeNull();
});

test('without onOpenDrawer the drawer block shows the figure only and is not a button', () => {
  render(<><CashierSheet name="Bob Ross" cashiers={[]} onSwitch={() => {}} onAddAnother={() => {}} onSignOut={() => {}}
    drawer={{ figure: '$12.00', verbs: 'Pay in · Pay out · Close register', opener: 'opened 10:00 by Bob' }} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  const block = screen.getByTestId('user-sheet-drawer');
  expect(within(block).getByText('$12.00')).not.toBeNull();
  expect(block.getAttribute('role')).toBeNull();
  expect(screen.queryByTestId('user-sheet-drawer-verbs')).toBeNull();
  expect(screen.queryByText('opened 10:00 by Bob')).toBeNull();
});

test("the sheet shows this cashier's sales today and the drawer while a session is open", async () => {
  const app = await setup();
  act(() => app.register.setSetting(true));
  await act(async () => { await app.register.actions.openSession({ expectedFloatMinor: 10000, countedFloatMinor: 10000 }); });
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  const now = new Date().toISOString();
  await act(async () => { await app.orders.bulkInsert([
    { ...base, createdAt: now, updatedAt: now, id: 'mine', cashierRef: '2', totalMinor: 300, subtotalMinor: 300,
      syncStatus: 'applied', payments: [{ id: 'p1', method: 'cash', amountMinor: 300 }] },
    { ...base, createdAt: now, updatedAt: now, id: 'other', cashierRef: '3', totalMinor: 500, subtotalMinor: 500,
      syncStatus: 'applied', payments: [{ id: 'p2', method: 'cash', amountMinor: 500 }] },
    { ...base, createdAt: now, updatedAt: now, id: 'refused', cashierRef: '2', totalMinor: 100, subtotalMinor: 100,
      syncStatus: 'rejected', payments: [{ id: 'p3', method: 'cash', amountMinor: 100 }] },
  ]); });
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  expect(await within(await screen.findByTestId('user-sheet-sales-today')).findByText('$3.00')).not.toBeNull();
  expect(within(screen.getByTestId('user-sheet-sales-today')).getByText('Your sales today')).not.toBeNull();
  const drawer = within(screen.getByTestId('user-sheet-drawer'));
  expect(drawer.getByText('In the drawer')).not.toBeNull();
  expect(drawer.getByText('$100.00')).not.toBeNull();
}, 20_000);

test('with register sessions off the sheet shows sales today but no drawer', async () => {
  const app = await setup();
  const now = new Date().toISOString();
  await act(async () => { await app.orders.insert({ ...base, createdAt: now, updatedAt: now,
    id: 'mine', cashierRef: '2', totalMinor: 300, subtotalMinor: 300, syncStatus: 'applied',
    payments: [{ id: 'p1', method: 'cash', amountMinor: 300 }] }); });
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  expect(await within(await screen.findByTestId('user-sheet-sales-today')).findByText('$3.00')).not.toBeNull();
  expect(screen.queryByTestId('user-sheet-drawer')).toBeNull();
  expect(screen.queryByTestId('user-sheet-drawer-verbs')).toBeNull();
}, 20_000);

test('the sheet names the store, bands the hand-off and links to WordPress admin', async () => {
  await setup();
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  expect(screen.getByTestId('user-sheet-description').textContent).toBe(stores[0].name);
  const switchUser = within(screen.getByTestId('user-sheet-switch-user'));
  expect(switchUser.getByText('Hand the till to')).not.toBeNull();
  expect(switchUser.getByTestId('user-sheet-another-account')).not.toBeNull();
  expect(screen.getByTestId('user-sheet-sign-out')).not.toBeNull();
  const openURL = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  fireEvent.click(screen.getByTestId('user-sheet-wp-admin'));
  expect(openURL).toHaveBeenCalledWith('https://shop.example/admin-test/wp-admin');
}, 20_000);

test('without the order store the sheet shows no sales today and no drawer', async () => {
  render(<><SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
    storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
    cashiers={[{ uuid: 'b', name: 'Sam' }]} heldCartKey="held-test" onSwitchCashier={async () => null} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  expect(screen.queryByTestId('user-sheet-sales-today')).toBeNull();
  expect(screen.queryByTestId('user-sheet-drawer')).toBeNull();
  expect(screen.queryByTestId('user-sheet-foot')).toBeNull();
  expect(screen.getByTestId('user-sheet-user-b')).not.toBeNull();
}, 20_000);
