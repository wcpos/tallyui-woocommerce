import { setLineQuantity, EMPTY_CART_TEXT } from './cart-line-helpers';
// Uniwind's runtime does not load under Vitest; the report cards' donut reads fixed colours.
vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() }, useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { orderReference } from '@tallyui/components';
import type { OrderCreateEnvelope, StoreOrder, StoreSettings, TallyConnector } from '@tallyui/core';
import { formatClosureDate, presetRange, type Closure, type CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { AppRailShown } from '../components/app-rail';
import { CatalogueView } from '../components/catalogue-view';
import { ReportsScreen } from '../components/reports-screen';
import { SaleScreen } from '../components/sale-screen';
import { drawerResultClass } from '../components/till-strip';
import { SessionProvider } from '../lib/auth/session-context';
import { loadSession, saveCashiers, saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { dayRange } from '../lib/reports/today-sales';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash, takeLeg } from './tender-helpers';
import { openRegisterPanel, sessionsOff, toggleRegisterSessions } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { CatalogueContext } from '../lib/catalogue/catalogue-context';
import { classesOf } from './classes-of';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  sessionsOff();
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const text = (testID: string) => screen.getByTestId(testID).textContent;

/** Opens a Reports menu chip and picks one of its rows. */
async function choose(name: 'cashier' | 'compare' | 'scope', value: string) {
  fireEvent.click(screen.getByTestId(`hero-chip-${name}`));
  fireEvent.click(within(await screen.findByTestId(`hero-${name}-menu`)).getByTestId(`hero-${name}-${value}`));
  expect(screen.queryByTestId(`hero-${name}-menu`)).toBeNull();
}

/** `synced` stands in for the catalogue's synced products; without it ReportsScreen reads the default empty catalogue. */
async function setup({ multiplePayments, storeSettings = noTaxSettings, rail = false, synced, connector }: { multiplePayments?: boolean; storeSettings?: StoreSettings; rail?: boolean; synced?: any[]; connector?: TallyConnector } = {}) {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const onBack = vi.fn();
  const reports = <ReportsScreen storeName={stores[0].name} currency={stores[0].currency} locale={stores[0].locale} onBack={onBack} />;
  const view = render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen multiplePayments={multiplePayments} storeSettings={storeSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} locale={stores[0].locale} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            onSwitchCashier={async () => null} cashiers={[]} />
          <AppRailShown.Provider value={rail}>
            {connector
              ? <CatalogueContext.Provider value={{ catalogue: { connector } as never, products: synced ?? [], productsLoaded: true, status: 'ready' }}>{reports}</CatalogueContext.Provider>
              : synced
              ? <CatalogueContext.Provider value={{ catalogue: null, products: synced, status: 'ready' }}>{reports}</CatalogueContext.Provider>
              : reports}
          </AppRailShown.Provider>
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { ...view, get register() { return register; }, orders: outbox.orders, onBack };
}

async function payCash() {
  fireEvent.click(within(screen.getByTestId('product-tile-80')).getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText(EMPTY_CART_TEXT);
}

async function openRegister(enable = true) {
  if (enable) await toggleRegisterSessions();
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
  // The open's render comes from the session subscription, outside act, and RNW's Pressable takes its new onPress in a
  // passive effect: under CI load a tile tapped now still holds the closed till's refusal. The empty act waits a task.
  await act(async () => {});
}

async function closeRegister(counted: string) {
  await openRegisterPanel();
  fireEvent.click(await screen.findByTestId('register-panel-close'));
  fireEvent.change(await screen.findByTestId('count-amount'), { target: { value: counted } });
  fireEvent.click(screen.getByTestId('count-close'));
  await screen.findByTestId('closure-print-document');
  fireEvent.click(await screen.findByTestId('closure-done'));
  await waitFor(() => expect(screen.queryByTestId('closure-print-document')).toBeNull());
}

/** Opens the Closures room through the till strip's chevron (v2 `till-closures`). */
async function enterClosures() {
  fireEvent.click(screen.getByTestId('till-closures'));
  await screen.findByTestId('closures-scope-row');
}

/** The device's business day `days` before today, `yyyy-MM-dd`. */
const dayBefore = (days: number) => {
  const now = new Date();
  return formatClosureDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).toISOString(), { timezone: 'device', locale: 'en-US' }).date_ymd;
};

/** Writes a copy of the last real closure, moved to another day or closer, to the closures collection. */
async function copyClosure(app: Awaited<ReturnType<typeof setup>>, id: string, over: Partial<Closure>) {
  const source = (await app.orders.database.collections.closures.findOne(app.register.lastClosure!.id).exec())!.toJSON();
  await app.orders.database.collections.closures.insert({ ...source, id, session_id: id, ...over });
}

/** Reads the Export CSV of the current scope: its file name and its data rows' business days. */
async function exportClosures() {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:closures-test');
    static revokeObjectURL = vi.fn();
  });
  const anchors: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { anchors.push(this); });
  fireEvent.click(screen.getByTestId('closures-csv'));
  const csv = await (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).text();
  return { filename: anchors[0].download, days: csv.split('\r\n').slice(1).map(line => line.split(',')[0].slice(1, -1)), csv };
}

async function movement(type: 'paid-in' | 'paid-out' | 'no-sale', amount: string | null, reason: string) {
  await openRegisterPanel();
  fireEvent.click(await screen.findByTestId(`register-panel-${type}`));
  if (amount !== null) fireEvent.change(await screen.findByTestId('movement-amount'), { target: { value: amount } });
  fireEvent.change(await screen.findByTestId('movement-reason'), { target: { value: reason } });
  fireEvent.click(screen.getByTestId('movement-confirm'));
  await waitFor(() => expect(screen.queryByTestId('movement-confirm')).toBeNull());
  fireEvent.click(screen.getByTestId('register-panel-dismiss'));
}

test('the till strip shows no register while register sessions are off', async () => {
  await setup();
  expect(screen.getByTestId('till-title').textContent).toContain('No register on this device');
  expect(screen.queryByTestId('till-status')).toBeNull();
  expect(screen.queryByTestId('till-since')).toBeNull();
  expect(screen.queryByTestId('till-equation')).toBeNull();
  expect(screen.queryByTestId('till-last-closure')).toBeNull();
  expect(screen.queryByTestId('reports-session-card')).toBeNull();
}, 20_000);

test('the till strip adds the open session up to the expected cash', async () => {
  const app = await setup();
  await openRegister();
  await movement('paid-out', '20.00', 'Milk');
  await payCash();
  await waitFor(() => expect(app.register.expected.cash).toBe(8300));
  expect(screen.getByTestId('till-status').textContent).toBe('● Open');
  expect(screen.getByTestId('till-since').textContent).toMatch(/^since \d{2}:\d{2} · Paul$/);
  expect(screen.getByTestId('till-term-float-amount').textContent).toBe('$100.00');
  expect(screen.getByTestId('till-term-cash-sales').textContent).toContain('Cash sales · 1');
  expect(screen.getByTestId('till-term-cash-sales-amount').textContent).toBe('$3.00');
  expect(screen.getByTestId('till-term-paid-out').textContent).toContain('Paid out · Milk');
  expect(screen.getByTestId('till-term-paid-out-amount').textContent).toBe('$20.00');
  expect(screen.getByTestId('till-expected').textContent).toContain('Expected in drawer');
  expect(screen.getByTestId('till-expected-amount').textContent).toBe('$83.00');
  expect(screen.queryByTestId('till-note')).toBeNull();
  expect(screen.queryByTestId('till-last-closure')).toBeNull();
}, 20_000);

test('the till strip folds three paid-ins and counts no-sales and voids', async () => {
  const app = await setup();
  await openRegister();
  await movement('paid-in', '1.00', 'A');
  await movement('paid-in', '2.00', 'B');
  await movement('paid-in', '3.00', 'C');
  expect(screen.getByTestId('till-term-paid-in').textContent).toContain('Paid in · 3');
  expect(screen.getByTestId('till-term-paid-in-amount').textContent).toBe('$6.00');
  expect(screen.queryByTestId('till-term-paid-in-0')).toBeNull();
  expect(screen.getByTestId('till-expected-amount').textContent).toBe('$106.00');
  await movement('no-sale', null, 'Drawer check');
  await openRegisterPanel();
  fireEvent.click(await screen.findByTestId('register-panel-movements'));
  fireEvent.click(await screen.findByTestId(`movement-void-${app.register.movements.find(row => row.reason === 'A')!.id}`));
  fireEvent.click(screen.getByTestId('register-panel-dismiss'));
  await waitFor(() => {
    const terms = [0, 1].map(index => [
      screen.getByTestId(`till-term-paid-in-${index}`).textContent ?? '',
      screen.getByTestId(`till-term-paid-in-${index}-amount`).textContent,
    ]);
    expect(terms.find(([label]) => label.includes('Paid in · B'))?.[1]).toBe('$2.00');
    expect(terms.find(([label]) => label.includes('Paid in · C'))?.[1]).toBe('$3.00');
    expect(screen.queryByTestId('till-term-paid-in')).toBeNull();
    expect(screen.getByTestId('till-expected-amount').textContent).toBe('$105.00');
    expect(screen.getByTestId('till-note').textContent).toBe('1 no-sale · 1 void');
  });
}, 20_000);

test('the till strip shows the last closure short in red after a close', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('102.00');
  await waitFor(() => {
    expect(screen.getByTestId('till-status').textContent).toBe('● Closed');
    expect(screen.getByTestId('till-since').textContent).toMatch(/^Closed \d{2}:\d{2} · Paul$/);
    expect(screen.getByTestId('till-expected-amount').textContent).toBe('$103.00');
    expect(screen.getByTestId('till-counted-amount').textContent).toBe('$102.00');
    expect(screen.getByTestId('till-result-amount').textContent).toBe('$1.00 short');
    expect(screen.getByTestId('till-last-closure').textContent).toMatch(/^Last closure #1 · Today \d{2}:\d{2} · \$1\.00 short$/);
    expect(screen.queryByTestId('till-term-float')).toBeNull();
    expect(screen.queryByTestId('reports-session-card')).toBeNull();
  });
}, 20_000);

test('the session card shows the open session, its expected cash and sales count, and leaves on close', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await enterClosures();
  const card = within(screen.getByTestId('reports-closures')).getByTestId('reports-session-card');
  expect(card.textContent).toContain(`● Open · ${app.register.registerName}`);
  expect(card.textContent).toMatch(/since \d{2}:\d{2} · Paul · 1 sale/);
  expect(within(card).getByTestId('session-expected').textContent).toBe('$103.00');
  expect(within(card).getByTestId('x-report-print').textContent).toBe('Print X-report');
  await closeRegister('103.00');
  await waitFor(() => {
    expect(screen.queryByTestId('reports-session-card')).toBeNull();
    expect(screen.queryByTestId('x-report-print')).toBeNull();
  });
}, 20_000);

test('Today starts empty and observes an Espresso cash sale', async () => {
  const app = await setup();
  // v2 draws an empty day whole: twelve 120-minute columns from 00:00.
  expect(screen.getAllByTestId(/^sales-hour-\d\d$/)).toHaveLength(12);
  const today = within(screen.getByTestId('reports-hero'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(text('card-payments-empty')).toBe('No payments in this period');
  // Closures is its own room now: the Sales page has no closures section.
  expect(screen.queryByTestId('reports-closures')).toBeNull();
  expect(screen.queryByTestId('x-report-print')).toBeNull();
  expect(screen.queryByTestId('closures-csv')).toBeNull();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  expect(text('hero-orders')).toBe('1');
  expect(text('hero-orders-delta')).toBe('—');
  expect(text('hero-average')).toBe('$3.00');
  expect(text('hero-average-delta')).toBe('—');
  expect(text('hero-items')).toBe('1');
  expect(text('hero-delta')).toBe('—');
  // The chart sits in the hero, and the Orders, Payments and Where sold cards right after it (v2 PeriodSection).
  expect(today.getByTestId('sales-room-hours')).not.toBeNull();
  expect(screen.getByTestId('reports-hero').nextElementSibling).toBe(screen.getByTestId('reports-period-section'));
  expect(text('card-orders-figure')).toBe('1');
  expect(text('card-where-sold-donut-row-store-value')).toBe('$3.00');
  expect(text('card-payments-donut-row-cash-value')).toBe('$3.00');
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('1 order')).not.toBeNull();
  expect(screen.queryByTestId('card-payments-empty')).toBeNull();
  // The donut centres read the screen's whole-unit money: no decimals.
  expect(text('card-payments-donut-figure')).toBe('$3');
  expect(text('card-where-sold-donut-figure')).toBe('$3');
  expect(screen.queryByText(/^Split tenders/)).toBeNull();
  expect(today.queryByText('No sales yet today.')).toBeNull();
  expect(text('card-taxes-figure')).toBe('$0.00');
  expect(screen.queryByTestId('reports-back')).toBeNull();
}, 20_000);

test('the Top products card lists the product the sale rang up', async () => {
  await setup();
  expect(text('card-products-empty')).toBe('No sales in this period');
  expect(text('card-products-figure')).toBe('0');
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  expect(text('card-products-figure')).toBe('1');
  const product = within(screen.getByTestId('card-products-row-0'));
  expect(product.getByText('Espresso')).not.toBeNull();
  expect(product.getByText('$3.00')).not.toBeNull();
  expect(product.getByText('100% · 1 sold')).not.toBeNull();
  expect(screen.queryByTestId('card-products-row-1')).toBeNull();
});

// A refused order is not a sale (sales-room.ts): the Products card leaves its product and amount out, as the hero does.
test('the Top products card leaves out a sale the store refused', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('card-products-figure')).toBe('1'));
  const [{ id }] = await app.orders.find().exec();
  await waitFor(async () => expect((await app.orders.findOne(id).exec())?.syncStatus).toBe('applied'));
  await act(async () => { await (await app.orders.findOne(id).exec())!.incrementalPatch({ syncStatus: 'rejected' }); });
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(text('card-products-figure')).toBe('0');
  expect(text('card-products-empty')).toBe('No sales in this period');
}, 20_000);

// The drawer still holds the cash a refused order took: the hero says how much (fixture: one $3.00 Espresso, paid cash).
test('the hero names the cash the orders the store refused took', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('card-products-figure')).toBe('1'));
  const [{ id }] = await app.orders.find().exec();
  await waitFor(async () => expect((await app.orders.findOne(id).exec())?.syncStatus).toBe('applied'));
  await act(async () => { await (await app.orders.findOne(id).exec())!.incrementalPatch({ syncStatus: 'rejected' }); });
  await waitFor(() => expect(text('hero-not-accepted')).toBe('Not accepted by the store: 1 · $3.00 cash taken'));
}, 20_000);

test('a refused sale that a later sale replaced is not "Not accepted"', async () => {
  const app = await setup();
  await payCash();
  const [first] = await app.orders.find().exec();
  await payCash();
  const second = (await app.orders.find().exec()).find(order => order.id !== first.id)!;
  await waitFor(async () => expect((await app.orders.findOne(first.id).exec())?.syncStatus).toBe('applied'));
  await act(async () => { await first.incrementalPatch({ syncStatus: 'rejected' }); });
  await screen.findByTestId('hero-not-accepted');
  await act(async () => { await second.incrementalPatch({ saleId: first.id }); });
  await waitFor(() => expect(screen.queryByTestId('hero-not-accepted')).toBeNull());
}, 20_000);

test('a refused sale replaced by another cashier\'s sale is not "Not accepted" under the first cashier\'s chip', async () => {
  const me = loadSession()!;
  saveCashiers({ [me.site.home]: [{ ...me, tokens: { ...me.tokens, user: { id: 5, uuid: 'ann', displayName: 'Ann' } } }] });
  const app = await setup();
  await payCash();
  const [first] = await app.orders.find().exec();
  await payCash();
  const second = (await app.orders.find().exec()).find(order => order.id !== first.id)!;
  await waitFor(async () => expect((await app.orders.findOne(first.id).exec())?.syncStatus).toBe('applied'));
  await act(async () => {
    await first.incrementalPatch({ syncStatus: 'rejected' });
    await second.incrementalPatch({ saleId: first.id, cashierRef: '5' });
  });
  await choose('cashier', '2');
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(screen.queryByTestId('hero-not-accepted')).toBeNull();
}, 20_000);

test('unticking the replacement does not make its refused sale "Not accepted"', async () => {
  const app = await setup();
  await payCash();
  const [first] = await app.orders.find().exec();
  await payCash();
  const second = (await app.orders.find().exec()).find(order => order.id !== first.id)!;
  await waitFor(async () => expect((await app.orders.findOne(first.id).exec())?.syncStatus).toBe('applied'));
  await act(async () => {
    await first.incrementalPatch({ syncStatus: 'rejected' });
    await second.incrementalPatch({ saleId: first.id });
  });
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  fireEvent.click(await screen.findByTestId(`orders-panel-tick-${second.id}`));
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(screen.queryByTestId('hero-not-accepted')).toBeNull();
}, 20_000);

test('a refused sale replaced after the shown period is not "Not accepted" in that period', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await salesAt(app, [new Date(2026, 9, 5, 10), new Date(2026, 9, 6, 9)]);
    const [first, second] = await app.orders.find({ sort: [{ createdAt: 'asc' }] }).exec();
    await waitFor(async () => expect((await app.orders.findOne(first.id).exec())?.syncStatus).toBe('applied'));
    await act(async () => { await first.incrementalPatch({ syncStatus: 'rejected' }); });
    await choosePeriod('yesterday');
    await screen.findByTestId('hero-not-accepted');
    await act(async () => { await second.incrementalPatch({ saleId: first.id }); });
    await waitFor(() => expect(screen.queryByTestId('hero-not-accepted')).toBeNull());
  } finally { vi.useRealTimers(); }
}, 20_000);

test("the Categories card names the synced product's category for a sale in the period", async () => {
  // The fixture's Espresso (id 80) is in Coffee (id 25); the screen must hand the synced products to the card.
  await setup({ synced: products });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const coffee = within(await screen.findByTestId('card-categories-donut-row-25'));
  expect(coffee.getByText('Coffee')).not.toBeNull();
  expect(screen.queryByTestId('card-categories-donut-row-unknown')).toBeNull();
  expect(screen.queryByTestId('card-categories-unknown')).toBeNull();
});

test('the Cashiers card names the signed-in cashier who made the sale', async () => {
  await setup();
  expect(text('card-cashiers-empty')).toBe('No sales in this period');
  expect(text('card-cashiers-figure')).toBe('0');
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  expect(text('card-cashiers-figure')).toBe('1');
  const cashier = within(screen.getByTestId('card-cashiers-donut-row-2'));
  expect(cashier.getByText('Paul')).not.toBeNull();
  expect(cashier.getByText('1 order')).not.toBeNull();
  expect(cashier.queryByText('#2')).toBeNull();
  expect(text('card-cashiers-donut-row-2-value')).toBe('$3.00');
}, 20_000);

test('Today removes a sale when its createdAt moves to yesterday', async () => {
  const app = await setup();
  await payCash();
  const today = within(screen.getByTestId('reports-hero'));
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const [order] = await app.orders.find().exec();
  const createdAt = new Date(Date.parse(dayRange(new Date()).startIso) - 60_000).toISOString();
  await act(async () => { await order.incrementalPatch({ createdAt }); });
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(text('card-payments-empty')).toBe('No payments in this period');
}, 20_000);

test('the hero chart switches between By hour and Running total', async () => {
  await setup();
  // v2 shows the toggle on an empty day too.
  expect(screen.getByTestId('hero-chart-toggle')).not.toBeNull();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const hero = within(screen.getByTestId('reports-hero'));
  const toggle = within(hero.getByTestId('hero-chart-toggle'));
  expect(toggle.getByTestId('hero-chart-toggle-segment-hour').getAttribute('aria-checked')).toBe('true');
  expect(toggle.getByTestId('hero-chart-toggle-segment-hour').textContent).toBe('By hour');
  expect(toggle.getByTestId('hero-chart-toggle-segment-run').getAttribute('aria-checked')).toBe('false');
  expect(hero.getByTestId('hero-chart-peak').textContent).toBe('$3.00 · 1 order');
  expect(hero.queryByTestId('hero-chart-total')).toBeNull();
  fireEvent.click(toggle.getByText('Running total'));
  await waitFor(() => expect(hero.getByTestId('hero-chart-total').textContent).toBe('$3.00 now'));
  expect(hero.queryByTestId('hero-chart-peak')).toBeNull();
  expect(toggle.getByTestId('hero-chart-toggle-segment-run').getAttribute('aria-checked')).toBe('true');
  // v2 segmented-control/index.tsx:123: the open segment is the --selected tint; a closed one is not.
  expect(classesOf('hero-chart-toggle-segment-run')).toContain('bg-selected');
  expect(classesOf('hero-chart-toggle-segment-hour')).not.toContain('bg-selected');
  // :123 keeps the open fill on hover; a closed segment takes the accent wash. :132 is the one selected ink.
  expect(classesOf('hero-chart-toggle-segment-run')).toContain('web:hover:bg-selected');
  expect(classesOf('hero-chart-toggle-segment-run')).not.toContain('web:hover:bg-accent');
  expect(classesOf('hero-chart-toggle-segment-hour')).toContain('web:hover:bg-accent');
  expect(classesOf('hero-chart-toggle-segment-run-label')).toContain('text-selected-foreground');
  expect(classesOf('hero-chart-toggle-segment-hour-label')).toContain('text-muted-foreground');
}, 20_000);

test('the hero compares with yesterday up to the same time', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await payCash();
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    const [order] = await app.orders.find().exec();
    await act(async () => { await order.incrementalPatch({ createdAt: new Date(2026, 9, 5, 10, 0).toISOString() }); });
    await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
    expect(text('hero-delta')).toBe('−100.0% vs yesterday');
    expect(text('hero-orders')).toBe('0');
    expect(text('hero-orders-delta')).toBe('−1');
    expect(text('hero-average')).toBe('$0.00');
    expect(text('hero-average-delta')).toBe('−$3.00');
    expect(text('hero-items')).toBe('0');
    expect(text('hero-items-delta')).toBe('−1');
    // One hour of sales is two 30-minute steps (v2 getNiceMinuteInterval).
    expect(screen.getByTestId('sales-hour-1000').getAttribute('aria-label')).toBe('10:00 — today $0.00, 0 orders; yesterday $3.00');
    expect(screen.queryByTestId('hero-chart-peak')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
}, 20_000);

test("yesterday's sales after this time are not compared", async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await payCash();
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    const [order] = await app.orders.find().exec();
    await act(async () => { await order.incrementalPatch({ createdAt: new Date(2026, 9, 5, 16, 0).toISOString() }); });
    await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
    expect(text('hero-delta')).toBe('—');
    expect(screen.getByTestId('hero-delta').getAttribute('aria-label')).toBe('No comparison');
    expect(text('hero-orders-delta')).toBe('—');
    expect(text('hero-items-delta')).toBe('—');
  } finally {
    vi.useRealTimers();
  }
}, 20_000);

test('a split tender counts once per method', async () => {
  await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText(EMPTY_CART_TEXT);
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  expect(text('hero-orders')).toBe('1');
  expect(text('hero-items')).toBe('2');
  const payments = within(screen.getByTestId('card-payments'));
  expect(text('card-payments-donut-row-cash-value')).toBe('$2.00');
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('1 order')).not.toBeNull();
  expect(text('card-payments-donut-row-external-value')).toBe('$4.00');
  expect(within(screen.getByTestId('card-payments-donut-row-external')).getByText('Card terminal')).not.toBeNull();
  expect(within(screen.getByTestId('card-payments-donut-row-external')).getByText('1 order')).not.toBeNull();
  expect(payments.getByText('Split tenders: 1')).not.toBeNull();
}, 20_000);

test('taxes by rate', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.30'));
  expect(text('card-taxes-figure')).toBe('$0.30');
  const row = within(screen.getByTestId('card-taxes-rate-100000'));
  expect(row.getByText('Tax 10%')).not.toBeNull();
  expect(row.getByText('$0.30')).not.toBeNull();
  expect(row.getByText('on $3.00')).not.toBeNull();
  expect(text('card-taxes-net')).toBe('$3.00');
  expect(text('card-taxes-gross')).toBe('$3.30');
  expect(screen.getByTestId('reports-period-section').contains(screen.getByTestId('card-taxes'))).toBe(true);
  expect(screen.queryByTestId('sales-room-taxes')).toBeNull();
}, 20_000);

test('Closures lists real counted closures newest first, each stamped with the register name', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('103.00');
  await enterClosures();
  const room = within(screen.getByTestId('reports-closures'));
  await waitFor(() => expect(room.getAllByTestId(/^closure-title-/)).toHaveLength(1));
  const first = app.register.lastClosure!;
  const name = app.register.registerName;
  expect(name).toMatch(/^Register /);
  expect(first.breakdowns.register_name).toBe(name);
  expect(room.getByTestId(`closure-title-${first.id}`).textContent).toBe(`Closure 1 · ${name}`);
  expect(room.getByTestId(`closure-expected-${first.id}`).textContent).toBe('$103.00');
  expect(room.getByTestId(`closure-counted-${first.id}`).textContent).toBe('$103.00');
  expect(room.getByTestId(`closure-difference-${first.id}`).textContent).toBe('$0.00');
  expect(room.getByTestId(`closure-result-${first.id}`).textContent).toBe('Exact');
  await openRegister(false);
  await closeRegister('100.00');
  await waitFor(() => expect(room.getAllByTestId(/^closure-title-/).map(row => row.textContent)).toEqual([`Closure 2 · ${name}`, `Closure 1 · ${name}`]));
}, 20_000);

test('Print closure in the panel prints the mounted Copy document without changing the closure', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  expect(screen.queryByTestId('x-report-print')).toBeNull();
  const closure = app.register.lastClosure!;
  const collection = app.orders.database.collections.closures;
  const before = (await collection.findOne(closure.id).exec())!.toJSON();
  await enterClosures();
  const printedDocuments: { text: string | null; dataPrint: string | null | undefined; todayHidden: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const document = screen.queryByTestId('closure-print-document');
    printedDocuments.push({ text: document?.textContent ?? null, dataPrint: document?.getAttribute('data-print'),
      todayHidden: screen.getByTestId('reports-closures').closest('[data-print="hide"]') !== null });
  });
  fireEvent.click(await screen.findByTestId(`closure-open-${closure.id}`));
  await screen.findByTestId('closure-panel');
  fireEvent.click(screen.getByTestId('closure-reprint'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0].dataPrint).toBe('closure');
  expect(printedDocuments[0].todayHidden).toBe(true);
  expect(printedDocuments[0].text).toContain('Closure #1');
  expect(printedDocuments[0].text).toContain('Copy');
  expect(printedDocuments[0].text).toContain('Counted: $100.00');
  expect(screen.getByTestId('closure-print-document').textContent).toContain('Copy');
  fireEvent.click(screen.getByTestId('closure-reprint'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  expect(printedDocuments[1].dataPrint).toBe('closure');
  expect(printedDocuments[1].todayHidden).toBe(true);
  expect(printedDocuments[1].text).toContain('Copy');
  expect((await collection.findOne(closure.id).exec())!.toJSON()).toEqual(before);
}, 20_000);

test('tapping a closure opens its panel, Print closure prints the Copy and Close returns', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('103.00');
  const closure = app.register.lastClosure!;
  await enterClosures();
  fireEvent.click(await screen.findByTestId(`closure-open-${closure.id}`));
  await screen.findByTestId('closure-panel');
  expect(screen.getByTestId('closure-panel-title').textContent).toBe('Closure 1');
  expect(screen.getByTestId('closure-figure-expected').textContent).toBe('$103.00');
  expect(screen.getByTestId('closure-figure-counted').textContent).toBe('$103.00');
  expect(screen.getByTestId('closure-result-word').textContent).toBe('Variance · Exact');
  expect(screen.queryByTestId('closure-recount')).toBeNull();
  const printedDocuments: (string | null | undefined)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printedDocuments.push(screen.queryByTestId('closure-print-document')?.textContent);
  });
  fireEvent.click(screen.getByTestId('closure-reprint'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0]).toContain('Closure #1');
  expect(printedDocuments[0]).toContain('Copy');
  expect(screen.getByTestId('closure-panel')).not.toBeNull();
  fireEvent.click(screen.getByTestId('closure-panel-close'));
  await waitFor(() => expect(screen.queryByTestId('closure-panel')).toBeNull());
}, 20_000);

test('Print X report prints the mounted open session with its expected cash', async () => {
  const app = await setup();
  await openRegister();
  await openRegisterPanel();
  fireEvent.click(await screen.findByTestId('register-panel-paid-out'));
  fireEvent.change(await screen.findByTestId('movement-amount'), { target: { value: '20.00' } });
  fireEvent.change(screen.getByTestId('movement-reason'), { target: { value: 'Milk' } });
  fireEvent.click(screen.getByTestId('movement-confirm'));
  await waitFor(() => expect(within(screen.getByTestId('register-panel-expected')).getByText('$80.00')).not.toBeNull());
  await waitFor(() => expect(screen.queryByTestId('movement-confirm')).toBeNull());
  fireEvent.click(screen.getByTestId('register-panel-dismiss'));
  await payCash();
  await waitFor(() => expect(app.register.expected.cash).toBe(8300));
  const before = app.register.session;
  await enterClosures();
  const printedDocuments: { text: string | null; dataPrint: string | null; todayHidden: boolean; opened: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const report = screen.getByTestId('closure-print-document');
    printedDocuments.push({ text: report.textContent, dataPrint: report.getAttribute('data-print'), opened: within(report).queryByText(/^Opened: .+ Paul$/) !== null,
      todayHidden: screen.getByTestId('reports-closures').closest('[data-print="hide"]') !== null });
  });
  const button = within(screen.getByTestId('reports-session-card')).getByTestId('x-report-print');
  expect(button.textContent).toBe('Print X-report');
  fireEvent.click(button);
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0].opened).toBe(true);
  expect(printedDocuments[0].text).not.toContain('Closed:');
  expect(printedDocuments[0].dataPrint).toBe('closure');
  expect(printedDocuments[0].todayHidden).toBe(true);
  expect(printedDocuments[0].text).toContain('X report');
  expect(printedDocuments[0].text).toContain(`Register: ${app.register.registerName}`);
  expect(printedDocuments[0].text).toContain('Expected: $83.00');
  expect(printedDocuments[0].text).not.toContain('Closure #');
  expect(app.register.session).toEqual(before);
  expect(await app.orders.database.collections.closures.find().exec()).toHaveLength(0);
}, 20_000);

test("the till strip's Print X-report prints the mounted open session, as the session card's does", async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.expected.cash).toBe(10300));
  const before = app.register.session;
  const printedDocuments: { text: string | null; dataPrint: string | null; todayHidden: boolean; opened: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const report = screen.getByTestId('closure-print-document');
    printedDocuments.push({ text: report.textContent, dataPrint: report.getAttribute('data-print'), opened: within(report).queryByText(/^Opened: .+ Paul$/) !== null,
      todayHidden: screen.getByTestId('reports-hero').closest('[data-print="hide"]') !== null });
  });
  expect(screen.queryByTestId('till-reprint')).toBeNull();
  const button = within(screen.getByTestId('till-actions')).getByTestId('till-xreport');
  expect(button.textContent).toBe('Print X-report');
  fireEvent.click(button);
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0].opened).toBe(true);
  expect(printedDocuments[0].text).not.toContain('Closed:');
  expect(printedDocuments[0].dataPrint).toBe('closure');
  expect(printedDocuments[0].todayHidden).toBe(true);
  expect(printedDocuments[0].text).toContain('X report');
  expect(printedDocuments[0].text).toContain('Expected: $103.00');
  expect(printedDocuments[0].text).not.toContain('Closure #');
  expect(app.register.session).toEqual(before);
  expect(await app.orders.database.collections.closures.find().exec()).toHaveLength(0);
}, 20_000);

test("the till strip's last closure opens its panel, and its Print closure prints the Copy", async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const closure = app.register.lastClosure!;
  expect(screen.queryByTestId('till-xreport')).toBeNull();
  const printed: (string | null | undefined)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printed.push(screen.queryByTestId('closure-print-document')?.textContent);
  });
  fireEvent.click(await screen.findByTestId('till-reprint'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printed[0]).toContain('Closure #1');
  expect(printed[0]).toContain('Copy');
  expect(screen.queryByTestId('closure-panel')).toBeNull();
  fireEvent.click(screen.getByTestId('till-last-closure'));
  await screen.findByTestId('closure-panel');
  expect(screen.getByTestId('closure-panel-title').textContent).toBe(`Closure ${closure.number}`);
  fireEvent.click(screen.getByTestId('closure-panel-close'));
  await waitFor(() => expect(screen.queryByTestId('closure-panel')).toBeNull());
}, 20_000);

test('Export CSV downloads the listed closures and revokes its object URL', async () => {
  await setup();
  await openRegister();
  await closeRegister('100.00');
  await enterClosures();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:closures-test');
    static revokeObjectURL = vi.fn();
  });
  const anchors: HTMLAnchorElement[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchors.push(this);
    expect(this.isConnected).toBe(true);
  });
  const button = await screen.findByTestId('closures-csv');
  expect(button.textContent).toBe('Export CSV');
  fireEvent.click(button);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob).toBeInstanceOf(Blob);
  expect(blob.type).toBe('text/csv;charset=utf-8');
  expect(await blob.text()).toContain('"Business day","Closure"');
  expect(click).toHaveBeenCalledTimes(1);
  expect(anchors[0].download).toBe(`closures-${dayBefore(0)}-${dayBefore(0)}.csv`);
  expect(anchors[0].href).toBe('blob:closures-test');
  expect(anchors[0].isConnected).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:closures-test');
}, 20_000);

test('the till strip chevron opens the Closures room under its own bar, and the arrow returns to Sales', async () => {
  const app = await setup();
  expect(screen.queryByTestId('reports-closures')).toBeNull();
  expect(screen.getByRole('button', { name: 'Closures' })).toBe(screen.getByTestId('till-closures'));
  await enterClosures();
  expect(screen.queryByTestId('reports-hero')).toBeNull();
  expect(screen.queryByTestId('reports-till')).toBeNull();
  expect(app.register.registerName).toBeTruthy();
  expect(text('closures-title')).toBe(`${stores[0].name} · ${app.register.registerName}`);
  const row = within(screen.getByTestId('closures-scope-row'));
  expect(row.getByTestId('reports-period').textContent).toContain('Today · ');
  expect(within(row.getByTestId('closures-cashier')).getByTestId('hero-chip-cashier').textContent).toContain('All cashiers');
  expect(row.getByTestId('closures-csv').textContent).toBe('Export CSV');
  expect(within(screen.getByTestId('reports-closures')).getByTestId('closures-empty').textContent).toBe('No closures in this period');
  fireEvent.click(screen.getByRole('button', { name: 'Sales' }));
  await screen.findByTestId('reports-hero');
  expect(screen.queryByTestId('closures-scope-row')).toBeNull();
  expect(screen.queryByTestId('reports-back-sales')).toBeNull();
}, 20_000);

/** The testIDs, in document order, each inside the bar row. */
function inBarInOrder(bar: HTMLElement, ids: string[]) {
  const elements = ids.map(id => screen.getByTestId(id));
  for (const element of elements) expect(bar.contains(element)).toBe(true);
  for (let i = 1; i < elements.length; i++) {
    expect(elements[i - 1].compareDocumentPosition(elements[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
}

test("beside the rail Sales opens with v2's bar: the scope title at the start, then the bell and the avatar", async () => {
  const app = await setup({ rail: true });
  const bar = await screen.findByTestId('reports-bar');
  expect(text('reports-title')).toBe(`${stores[0].name} · ${app.register.registerName}`);
  expect(screen.getByTestId('reports-bar-title-slot').contains(screen.getByTestId('reports-title'))).toBe(true);
  inBarInOrder(bar, ['reports-title', 'reports-bar-bell', 'reports-bar-avatar']);
  // The rail is the navigation: no title row and no Back.
  expect(screen.queryByTestId('reports-back')).toBeNull();
  expect(within(bar).queryByText('Reports')).toBeNull();
  // The rooms below keep their place: the till strip and the scope row are not in the bar.
  expect(bar.contains(screen.getByTestId('reports-scope-strip'))).toBe(false);
}, 20_000);

test('beside the rail Closures carries the arrow back, its title, the bell and the avatar in one row', async () => {
  await setup({ rail: true });
  await enterClosures();
  const bar = screen.getByTestId('reports-bar');
  inBarInOrder(bar, ['closures-bar', 'reports-back-sales', 'closures-title', 'reports-bar-bell', 'reports-bar-avatar']);
  expect(screen.queryByTestId('reports-title')).toBeNull();
  expect(bar.contains(screen.getByTestId('closures-scope-row'))).toBe(false);
  fireEvent.click(screen.getByTestId('reports-back-sales'));
  expect(await screen.findByTestId('reports-title')).not.toBeNull();
}, 20_000);

// react-native-web drops a ScrollView's contentContainerClassName from the DOM, so read it off the component that took the testID.
function contentClassesOf(testID: string): string[] {
  type Fiber = { memoizedProps?: { testID?: string; contentContainerClassName?: unknown }; return?: Fiber };
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))!] as Fiber | undefined;
  for (; fiber; fiber = fiber.return) {
    const { contentContainerClassName: classes, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof classes === 'string') return classes.split(/\s+/);
  }
  return [];
}

// v2 leaves one page gutter between the bar and the first card (page-bar `ground.pt`, no bottom padding; the room's
// `ground.p`), and at the sides: 12 px in a window, 16 on a phone (ground.ts:46-72). The bar's row ends in pb-2 in both
// layouts, so each room starts at pt-2, never the p-4 that made 24.
test.each([true, false])('under the bar each room starts one gutter down and one gutter in, rail %s', async rail => {
  if (!rail) vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  const px = rail ? 'px-3' : 'px-4';
  await setup({ rail });
  expect(classesOf(rail ? 'reports-bar' : 'reports-bar-slot-row')).toContain(px);
  const room = (testID: string) => {
    const classes = contentClassesOf(testID);
    expect(classes).toEqual(expect.arrayContaining(['pt-2', px, 'pb-4', 'gap-4']));
    expect(classes).not.toContain(rail ? 'px-4' : 'px-3');
    expect(classes).not.toContain('p-4');
  };
  room('reports-sales-room');
  await enterClosures();
  room('reports-closures-room');
}, 20_000);

test('with no rail the bar keeps the menu and the Reports title, with the scope title on a row of its own', async () => {
  const app = await setup();
  const bar = await screen.findByTestId('reports-bar');
  expect(within(bar).getByText('Reports')).not.toBeNull();
  expect(bar.contains(screen.getByTestId('reports-menu'))).toBe(true);
  expect(screen.queryByTestId('reports-back')).toBeNull();
  expect(bar.contains(screen.getByTestId('reports-bar-bell'))).toBe(true);
  expect(text('reports-title')).toBe(`${stores[0].name} · ${app.register.registerName}`);
}, 20_000);

test('the Closures date menu scopes the list: Today shows only today, a wider period the earlier day too', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const today = app.register.lastClosure!;
  const earlier = dayBefore(3);
  const at = new Date(`${earlier}T12:00:00`).toISOString();
  await copyClosure(app, 'earlier', { number: 0, business_day: earlier, opened_at: at, closed_at: at });
  await enterClosures();
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(1));
  expect(screen.getByTestId(`closure-row-${today.id}`)).not.toBeNull();
  // Three days back always falls in this or last week or month; prefer a period that runs to today.
  const wider = (['thisWeek', 'thisMonth', 'lastWeek', 'lastMonth'] as const).find(preset => {
    const range = presetRange(preset, new Date(), 'device');
    return range.from <= earlier && earlier <= range.to;
  })!;
  fireEvent.click(screen.getByTestId('reports-period'));
  fireEvent.click(await screen.findByTestId(`reports-period-${wider}`));
  await waitFor(() => expect(screen.getByTestId('closure-row-earlier')).not.toBeNull());
  expect(screen.queryByTestId(`closure-row-${today.id}`) !== null).toBe(presetRange(wider, new Date(), 'device').to >= dayBefore(0));
  // The Sales page keeps its own date: still Today.
  fireEvent.click(screen.getByTestId('reports-back-sales'));
  expect((await screen.findByTestId('reports-period')).textContent).toContain('Today · ');
}, 20_000);

test('the Closures date menu scopes the list to a custom one-day range', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const today = app.register.lastClosure!;
  const earlier = dayBefore(3);
  const at = new Date(`${earlier}T12:00:00`).toISOString();
  await copyClosure(app, 'earlier', { number: 0, business_day: earlier, opened_at: at, closed_at: at });
  await enterClosures();
  fireEvent.click(screen.getByTestId('reports-period'));
  if (!screen.queryByTestId(`reports-period-calendar-day-${earlier}`)) {
    fireEvent.click(screen.getByTestId('reports-period-calendar-prev'));
  }
  fireEvent.click(screen.getByTestId(`reports-period-calendar-day-${earlier}`));
  fireEvent.click(screen.getByTestId(`reports-period-calendar-day-${earlier}`));
  fireEvent.click(screen.getByTestId('reports-period-apply'));
  await waitFor(() => expect(screen.getByTestId('closure-row-earlier')).not.toBeNull());
  expect(screen.queryByTestId(`closure-row-${today.id}`)).toBeNull();
  expect(text('reports-period')).not.toContain('·');
}, 20_000);

test('the Closures cashier chip narrows the list to one closer; All cashiers lists both', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const paul = app.register.lastClosure!;
  expect(paul.closed_by).toBe('2');
  await copyClosure(app, 'ann', { number: 2, closed_by: '5' });
  await enterClosures();
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(2));
  await choose('cashier', '2');
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(1));
  expect(screen.getByTestId(`closure-row-${paul.id}`)).not.toBeNull();
  expect(text('hero-chip-cashier')).toContain('Paul');
  await choose('cashier', 'all');
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(2));
}, 20_000);

test('a closure by a roster cashier names them, and an unknown closer reads Cashier #id, in the list, panel and print', async () => {
  // v2 hooks/use-cashier-label.ts:57-62: a staff id reads the logged-in user's display_name, else "Cashier #{id}".
  const me = loadSession()!;
  saveCashiers({ [me.site.home]: [{ ...me, tokens: { ...me.tokens, user: { id: 5, uuid: 'ann', displayName: 'Ann' } } }] });
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const paul = app.register.lastClosure!;
  // Closures written elsewhere carry no stamped names, so the screen resolves the ids itself.
  const labels = { ...(paul.breakdowns.labels as Record<string, unknown>), opened_by_name: '', closed_by_name: '' };
  const breakdowns = { ...paul.breakdowns, opened_by_name: '', closed_by_name: '', labels };
  const later = new Date(Date.parse(paul.closed_at) + 1000).toISOString();
  await copyClosure(app, 'ghost', { number: 2, closed_by: '7', breakdowns });
  await copyClosure(app, 'ann', { number: 3, closed_by: '5', breakdowns, closed_at: later });
  await waitFor(() => expect(app.register.lastClosure?.id).toBe('ann'));
  // Closed, the strip's line under the register name reads "Closed {time} · {closer}".
  expect(text('till-since')).toMatch(/^Closed .* · Ann$/);
  await openRegister(false);
  const live = await app.orders.database.collections.register_sessions.findOne(app.register.session!.id).exec();
  await act(async () => { await live!.incrementalPatch({ opened_by: '5' }); });
  await waitFor(() => expect(text('till-since')).toContain('· Ann'));
  await enterClosures();
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(3));
  expect(text(`closure-subline-${paul.id}`)).toContain('· Paul');
  expect(text('closure-subline-ann')).toContain('· Ann');
  expect(text('closure-subline-ghost')).toContain('· Cashier #7');
  expect(text('reports-session-card')).toContain('· Ann ·');
  fireEvent.click(screen.getByTestId('closure-open-ann'));
  await screen.findByTestId('closure-panel');
  expect(text('closure-panel-closer')).toBe('Ann');
  const printed: (string | null | undefined)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printed.push(screen.queryByTestId('closure-print-document')?.textContent);
  });
  fireEvent.click(screen.getByTestId('closure-reprint'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printed[0]).toContain('Ann');
  fireEvent.click(screen.getByTestId('closure-panel-close'));
  await waitFor(() => expect(screen.queryByTestId('closure-panel')).toBeNull());
  fireEvent.click(screen.getByTestId('closure-open-ghost'));
  await screen.findByTestId('closure-panel');
  expect(text('closure-panel-closer')).toBe('Cashier #7');
}, 30_000);

test('the Closures CSV names each closer as the closures list does: a roster cashier, and Cashier #id for an unknown one', async () => {
  const me = loadSession()!;
  saveCashiers({ [me.site.home]: [{ ...me, tokens: { ...me.tokens, user: { id: 5, uuid: 'ann', displayName: 'Ann' } } }] });
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  // Closures written with no stamped closer name: the CSV resolves the id as the list does.
  const breakdowns = { ...app.register.lastClosure!.breakdowns, closed_by_name: '' };
  await copyClosure(app, 'ann', { number: 2, closed_by: '5', breakdowns });
  await copyClosure(app, 'ghost', { number: 3, closed_by: '7', breakdowns });
  await enterClosures();
  await waitFor(() => expect(screen.getAllByTestId(/^closure-title-/)).toHaveLength(3));
  const [header, ...data] = (await exportClosures()).csv.split('\r\n').map(line => line.split(',').map(cell => cell.slice(1, -1)));
  const closerOf = (number: number) => data.find(row => row[header.indexOf('Closure')] === String(number))![header.indexOf('Closer')];
  for (const [id, number, name] of [['ann', 2, 'Ann'], ['ghost', 3, 'Cashier #7']] as const) {
    expect(closerOf(number)).toBe(name);
    expect(text(`closure-subline-${id}`).split(' · ').at(-1)).toBe(closerOf(number));
  }
}, 30_000);

test('the register stamps a roster cashier and Cashier #id into the closure as the Reports Cashiers card labels them', async () => {
  // One resolver serves useRegisterSession's labels and Reports, so a closure and the Cashiers card agree on an id.
  const me = loadSession()!;
  saveCashiers({ [me.site.home]: [{ ...me, tokens: { ...me.tokens, user: { id: 5, uuid: 'ann', displayName: 'Ann' } } }] });
  const app = await setup();
  await openRegister();
  await payCash();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(2));
  const [first, second] = await app.orders.find().exec();
  await act(async () => { await first.incrementalPatch({ cashierRef: '5' }); await second.incrementalPatch({ cashierRef: '7' }); });
  expect(within(await screen.findByTestId('card-cashiers-donut-row-5')).getByText('Ann')).not.toBeNull();
  expect(within(screen.getByTestId('card-cashiers-donut-row-7')).getByText('Cashier #7')).not.toBeNull();
  await closeRegister('106.00');
  const stamped = app.register.lastClosure!.breakdowns.cashiers as { id: string; name: string }[];
  expect([...stamped].sort((a, b) => a.id.localeCompare(b.id))).toEqual([{ id: '5', name: 'Ann' }, { id: '7', name: 'Cashier #7' }]);
}, 30_000);

test("the open session follows the Closures cashier chip: it counts only for its opener", async () => {
  // Ann is a second cashier on this till, so the chip offers her.
  const me = loadSession()!;
  saveCashiers({ [me.site.home]: [{ ...me, tokens: { ...me.tokens, user: { id: 5, uuid: 'ann', displayName: 'Ann' } } }] });
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  await copyClosure(app, 'ann', { number: 2, closed_by: '5' });
  await openRegister(false);
  expect(app.register.session?.opened_by).toBe('2');
  await enterClosures();
  await waitFor(() => expect(text('closure-stat-sessions')).toBe('3'));
  expect(screen.getByTestId('reports-session-card')).not.toBeNull();
  await choose('cashier', '5');
  await waitFor(() => expect(text('closure-stat-sessions')).toBe('1'));
  expect(screen.queryByTestId('reports-session-card')).toBeNull();
  expect(text('closures-count')).toBe('1 session');
  expect(screen.getByTestId('closure-row-ann')).not.toBeNull();
  await choose('cashier', '2');
  await waitFor(() => expect(text('closure-stat-sessions')).toBe('2'));
  expect(screen.getByTestId('reports-session-card')).not.toBeNull();
  expect(text('closures-count')).toBe('2 sessions');
}, 20_000);

test('the open session follows the Closures date: a period that ends before today leaves it out', async () => {
  await setup();
  await openRegister();
  await enterClosures();
  await waitFor(() => expect(text('closure-stat-sessions')).toBe('1'));
  expect(screen.getByTestId('reports-session-card')).not.toBeNull();
  fireEvent.click(screen.getByTestId('reports-period'));
  fireEvent.click(await screen.findByTestId('reports-period-lastWeek'));
  await waitFor(() => expect(text('closure-stat-sessions')).toBe('0'));
  expect(screen.queryByTestId('reports-session-card')).toBeNull();
  expect(text('closures-count')).toBe('0 sessions');
}, 20_000);

test("the Sales strip's last closure opens its panel when it falls outside the Closures room's Today", async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const closure = app.register.lastClosure!;
  const earlier = dayBefore(3);
  const at = new Date(`${earlier}T12:00:00`).toISOString();
  const doc = (await app.orders.database.collections.closures.findOne(closure.id).exec())!;
  await doc.incrementalPatch({ business_day: earlier, opened_at: at, closed_at: at });
  await waitFor(() => expect(app.register.lastClosure?.business_day).toBe(earlier));
  expect(text('till-last-closure')).not.toContain('Today');
  fireEvent.click(screen.getByTestId('till-last-closure'));
  await screen.findByTestId('closure-panel');
  expect(text('closure-panel-title')).toBe(`Closure ${closure.number}`);
}, 20_000);

test('Closures Export CSV exports the rows in scope, and is disabled on the Open tab', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const earlier = dayBefore(3);
  const at = new Date(`${earlier}T12:00:00`).toISOString();
  await copyClosure(app, 'earlier', { number: 0, business_day: earlier, opened_at: at, closed_at: at });
  await enterClosures();
  const button = screen.getByTestId('closures-csv');
  expect(button.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(screen.getByTestId('closures-filter-open'));
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
  fireEvent.click(screen.getByTestId('closures-filter-all'));
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBeNull());
  const { filename, days } = await exportClosures();
  expect(filename).toBe(`closures-${dayBefore(0)}-${dayBefore(0)}.csv`);
  expect(days).toEqual([dayBefore(0)]);
}, 20_000);

test('the drawer offers Reports only when an onOpenReports handler is supplied', () => {
  const props = { connector: createWooCommerceConnector(), currency: stores[0].currency, products,
    storeName: stores[0].name, cashierName: 'Paul', status: 'ready' as const, onSignOut: () => {} };
  const onOpenReports = vi.fn();
  const { rerender } = render(<><CatalogueView {...props} onOpenReports={onOpenReports} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  fireEvent.click(screen.getByTestId('drawer-item-reports'));
  expect(onOpenReports).toHaveBeenCalledOnce();
  rerender(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  expect(screen.queryByTestId('drawer-item-reports')).toBeNull();
}, 20_000);

test('the Payments tile opens a table of methods', async () => {
  const app = await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText(EMPTY_CART_TEXT);
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  fireEvent.click(screen.getByTestId('card-payments-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.getAllByTestId(/^sales-table-row-/).map(row => row.getAttribute('data-testid'))).toEqual([
    'sales-table-row-external', 'sales-table-row-cash',
  ]);
  expect(within(table.getByTestId('sales-table-row-external')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Card terminal', '1', '$4.00', '66.7%',
  ]);
  expect(within(table.getByTestId('sales-table-row-cash')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Cash', '1', '$2.00', '33.3%',
  ]);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', '1', '$6.00',
  ]);
  expect(table.getByTestId('sales-table-scope').textContent).toBe(`Today · ${app.register.registerName}`);
  expect(table.getByTestId('sales-table-status').textContent).toBe('1 order · $6.00');
  fireEvent.click(table.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  expect(text('card-payments-donut-row-cash-value')).toBe('$2.00');
}, 20_000);

test('an open table follows live data', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('card-payments-open'));
  expect(within(await screen.findByTestId('sales-table')).getByTestId('sales-table-row-cash')).not.toBeNull();
  const [order] = await app.orders.find().exec();
  const createdAt = new Date(Date.parse(dayRange(new Date()).startIso) - 60_000).toISOString();
  await act(async () => { await order.incrementalPatch({ createdAt }); });
  await waitFor(() => {
    const table = within(screen.getByTestId('sales-table'));
    expect(table.getByText('No payments in this period')).not.toBeNull();
    expect(table.getByTestId('sales-table-status').textContent).toBe('0 orders · $0.00');
  });
  expect(screen.getByTestId('sales-table')).not.toBeNull();
}, 20_000);

test('the Taxes card opens a table of rates', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.30'));
  fireEvent.click(screen.getByTestId('card-taxes-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.getByText('Taxes collected')).not.toBeNull();
  expect(within(table.getByTestId('sales-table-row-100000')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Tax 10%', '$3.00', '$0.30', '$3.30',
  ]);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', '$3.00', '$0.30', '$3.30',
  ]);
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
}, 20_000);

test('the Where sold card opens a table of channels', async () => {
  await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('card-where-sold-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.getByText('Channels')).not.toBeNull();
  expect(within(table.getByTestId('sales-table-row-store')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'In store', '1', '$3.00', '100.0%',
  ]);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', '1', '$3.00', '100.0%',
  ]);
  fireEvent.click(table.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
}, 20_000);

/** Opens a card's table and reads its title, its rows' cells and its total. */
async function openCardTable(opener: string) {
  fireEvent.click(screen.getByTestId(opener));
  const table = within(await screen.findByTestId('sales-table'));
  const cells = (row: HTMLElement) => within(row).getAllByText(/./).map(cell => cell.textContent);
  return {
    hasText: (copy: string) => table.queryByText(copy) !== null,
    rows: table.getAllByTestId(/^sales-table-row-/).map(row => [row.getAttribute('data-testid'), ...cells(row)]),
    total: cells(table.getByTestId('sales-table-total')),
    close: async () => {
      fireEvent.click(table.getByTestId('sales-table-close'));
      await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
    },
  };
}

test('the Top products card opens a table of products', async () => {
  await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const table = await openCardTable('card-products-open');
  expect(table.hasText('Top products')).toBe(true);
  expect(table.rows).toEqual([['sales-table-row-80', 'Espresso', '1', '$3.00']]);
  expect(table.total).toEqual(['All products', '1', '$3.00']);
  await table.close();
}, 20_000);

// v2 panels/panel.tsx:207-226 and line-filters.ts: the Products panel's category chip. Espresso (80) stays in Coffee
// (25); Cold Brew (84) is moved to Tea (26) so the one sale spans two categories.
const twoCategories = products.map(product => product.id === 84 ? { ...product, categories: [{ id: 26, name: 'Tea', slug: 'tea' }] } : product);

async function sellTwoCategories() {
  await setup({ synced: twoCategories });
  fireEvent.click(within(screen.getByTestId('product-tile-80')).getByText('Espresso'));
  fireEvent.click(within(screen.getByTestId('product-tile-84')).getByText('Cold Brew'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await waitFor(() => expect(text('hero-total')).toBe('$7.00'));
}

async function chooseCategory(value: string) {
  fireEvent.click(screen.getByTestId('detail-panel-category'));
  fireEvent.click(within(await screen.findByTestId('detail-panel-category-menu')).getByTestId(`detail-panel-category-${value}`));
  await waitFor(() => expect(screen.queryByTestId('detail-panel-category-menu')).toBeNull());
}

const bothProducts = [['sales-table-row-84', 'Cold Brew', '1', '$4.00'], ['sales-table-row-80', 'Espresso', '1', '$3.00']];

test("the Top products panel draws v2's All categories chip above its table (detail-panel-filters)", async () => {
  await sellTwoCategories();
  const table = await openCardTable('card-products-open');
  const filters = screen.getByTestId('detail-panel-filters');
  expect(within(filters).getByTestId('detail-panel-category').textContent).toBe('All categories');
  expect(filters.compareDocumentPosition(screen.getByTestId('sales-table-body')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(table.rows).toEqual(bothProducts);
  await table.close();
}, 20_000);

test('choosing a category narrows Top products to it, and the total, status and scope follow', async () => {
  await sellTwoCategories();
  await openCardTable('card-products-open');
  const scope = text('sales-table-scope');
  await chooseCategory('25');
  expect(text('detail-panel-category')).toBe('Coffee');
  const table = within(screen.getByTestId('sales-table'));
  expect(table.getAllByTestId(/^sales-table-row-/).map(row => row.getAttribute('data-testid'))).toEqual(['sales-table-row-80']);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual(['All products', '1', '$3.00']);
  expect(text('sales-table-status')).toBe('1 products · $3.00');
  expect(text('sales-table-scope')).toBe(`${scope} · Coffee`);
}, 20_000);

test("All categories or the chip's Clear shows every product again", async () => {
  await sellTwoCategories();
  await openCardTable('card-products-open');
  const status = text('sales-table-status');
  const rows = () => screen.getAllByTestId(/^sales-table-row-/).map(row => row.getAttribute('data-testid'));
  await chooseCategory('25');
  expect(rows()).toEqual(['sales-table-row-80']);
  fireEvent.click(screen.getByTestId('detail-panel-category-clear'));
  await waitFor(() => expect(rows()).toEqual(['sales-table-row-84', 'sales-table-row-80']));
  expect(text('sales-table-status')).toBe(status);
  expect(text('detail-panel-category')).toBe('All categories');
  await chooseCategory('26');
  expect(rows()).toEqual(['sales-table-row-84']);
  await chooseCategory('all');
  expect(rows()).toEqual(['sales-table-row-84', 'sales-table-row-80']);
  expect(screen.queryByTestId('detail-panel-category-clear')).toBeNull();
}, 20_000);

test('only the Top products panel draws the category chip', async () => {
  await sellTwoCategories();
  for (const opener of ['card-payments-open', 'card-taxes-open', 'card-where-sold-open', 'sales-room-orders-open', 'card-categories-open', 'card-cashiers-open']) {
    const table = await openCardTable(opener);
    expect(screen.queryByTestId('detail-panel-filters'), opener).toBeNull();
    expect(screen.queryByTestId('detail-panel-category'), opener).toBeNull();
    await table.close();
  }
}, 30_000);

test('the Categories card opens a table of categories', async () => {
  // The fixture's Espresso (id 80) is in Coffee (id 25).
  await setup({ synced: products });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const table = await openCardTable('card-categories-open');
  expect(table.hasText('Sales by category')).toBe(true);
  expect(table.rows).toEqual([['sales-table-row-25', 'Coffee', '1', '$3.00', '100.0%']]);
  expect(table.total).toEqual(['Total', '1', '$3.00']);
  await table.close();
}, 20_000);

test('the Cashiers card opens a table of cashiers', async () => {
  await setup();
  await payCash();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  const table = await openCardTable('card-cashiers-open');
  expect(table.hasText('Sales by cashier')).toBe(true);
  expect(table.rows).toEqual([['sales-table-row-2', 'Paul', '2', '$3.00', '$6.00']]);
  expect(table.total).toEqual(['Total', '2', '$3.00', '$6.00']);
  await table.close();
}, 20_000);

test("the hero's Orders line opens a table of today's orders", async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const [order] = await app.orders.find().exec();
  const date = new Date(order.createdAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const opener = screen.getByTestId('sales-room-orders-open');
  expect(opener.getAttribute('aria-label')).toBe('Open Orders table');
  expect(opener.contains(screen.getByTestId('hero-orders'))).toBe(true);
  fireEvent.click(opener);
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.getByText('Orders')).not.toBeNull();
  expect(table.getAllByTestId(/^sales-table-row-/)).toHaveLength(1);
  // The tick box's ✓ comes first; the Counted column is not painted on screen (v2 orders-panel.tsx).
  expect(within(table.getByTestId(`sales-table-row-${order.id}`)).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    '✓', orderReference(order), time, 'Paul', 'Cash', '$3.00',
  ]);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Counted', '$3.00',
  ]);
  expect(table.getByTestId('sales-table-status').textContent).toBe('1 of 1 counted');
  // v2 panels/specs.ts:190: Print report (and Export CSV) carry the Cashier column, Counted last.
  const printed = await printTable();
  expect(text('sales-table-print-head')).toBe('Order — Time — Cashier — Paid by — Total — Counted');
  expect(printed.rows).toEqual([`${orderReference(order)} — ${time} — Paul — Cash — $3.00 — Yes`]);
  fireEvent.click(table.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  expect(text('hero-orders')).toBe('1');
}, 20_000);

test('an open Orders table follows live data', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  const [order] = await app.orders.find().exec();
  expect(within(await screen.findByTestId('sales-table')).getByTestId(`sales-table-row-${order.id}`)).not.toBeNull();
  const createdAt = new Date(Date.parse(dayRange(new Date()).startIso) - 60_000).toISOString();
  await act(async () => { await order.incrementalPatch({ createdAt }); });
  await waitFor(() => {
    const table = within(screen.getByTestId('sales-table'));
    expect(table.getByText('No orders in this period')).not.toBeNull();
    expect(table.getByTestId('sales-table-status').textContent).toBe('0 of 0 counted');
  });
}, 20_000);

test('Export CSV downloads the open table', async () => {
  await setup();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:payments-test');
    static revokeObjectURL = vi.fn();
  });
  const anchors: HTMLAnchorElement[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchors.push(this);
    expect(this.isConnected).toBe(true);
  });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('card-payments-open'));
  const table = within(await screen.findByTestId('sales-table'));
  const button = table.getByTestId('sales-table-export');
  expect(button.textContent).toBe('Export CSV');
  fireEvent.click(button);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob).toBeInstanceOf(Blob);
  expect(blob.type).toBe('text/csv;charset=utf-8');
  expect(await blob.text()).toBe('"Method","Orders","Amount","Share"\r\n"Cash","1","$3.00","100.0%"\r\n"Total","1","$3.00",""');
  expect(click).toHaveBeenCalledTimes(1);
  expect(anchors[0].download).toMatch(/^sales-payments-(\d{4}-\d{2}-\d{2})-\1\.csv$/);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:payments-test');
  expect(screen.getByTestId('sales-table')).not.toBeNull();
}, 20_000);

test('Export CSV names the Orders table and carries its rows', async () => {
  const app = await setup();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:orders-test');
    static revokeObjectURL = vi.fn();
  });
  const anchors: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchors.push(this);
    expect(this.isConnected).toBe(true);
  });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const [order] = await app.orders.find().exec();
  const date = new Date(order.createdAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  const table = within(await screen.findByTestId('sales-table'));
  fireEvent.click(table.getByTestId('sales-table-export'));
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  const csv = (await blob.text()).split('\r\n');
  expect(csv[0]).toBe('"Order","Time","Cashier","Paid by","Total","Counted"');
  expect(csv[1]).toBe(`"${orderReference(order)}","${time}","Paul","Cash","$3.00","Yes"`);
  expect(anchors[0].download).toMatch(/^sales-orders-(\d{4}-\d{2}-\d{2})-\1\.csv$/);
}, 20_000);

test('a short drawer result is red, an over one green, an exact one muted', () => {
  expect(drawerResultClass(-100)).toBe('text-destructive');
  expect(drawerResultClass(50)).toBe('text-success');
  expect(drawerResultClass(0)).toBe('text-muted-foreground');
});

test('the hero compares with the same weekday last week when chosen', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await payCash();
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    const [order] = await app.orders.find().exec();
    await act(async () => { await order.incrementalPatch({ createdAt: new Date(2026, 8, 29, 10, 0).toISOString() }); });
    await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
    expect(text('hero-delta')).toBe('—');
    expect(text('hero-orders-delta')).toBe('—');
    expect(text('hero-chip-compare')).toBe('vs yesterday');
    fireEvent.click(screen.getByTestId('hero-chip-compare'));
    expect(within(await screen.findByTestId('hero-compare-menu')).getByTestId('hero-compare-menu-hint').textContent)
      .toBe('A live day is compared at the same time of day');
    expect(screen.queryByTestId('hero-compare-hint')).toBeNull();
    expect(text('hero-compare-lastweek')).toBe('vs last Tuesday');
    fireEvent.click(screen.getByTestId('hero-compare-lastweek'));
    expect(screen.queryByTestId('hero-compare-menu')).toBeNull();
    await waitFor(() => expect(text('hero-delta')).toBe('−100.0% vs last Tuesday'));
    expect(text('hero-orders-delta')).toBe('−1');
    expect(text('hero-average-delta')).toBe('−$3.00');
    expect(text('hero-items-delta')).toBe('−1');
    expect(screen.getByTestId('sales-hour-1000').getAttribute('aria-label')).toBe('10:00 — today $0.00, 0 orders; last Tuesday $3.00');
    expect(text('hero-chip-compare')).toBe('vs last Tuesday');
    await choose('compare', 'yesterday');
    await waitFor(() => expect(text('hero-delta')).toBe('—'));
    expect(text('hero-orders-delta')).toBe('—');
  } finally {
    vi.useRealTimers();
  }
}, 20_000);

test('the cashier chip narrows every period figure to one cashier', async () => {
  const app = await setup();
  expect(text('hero-chip-cashier')).toBe('Everyone');
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  expect(within(await screen.findByTestId('hero-cashier-menu')).getAllByRole('menuitem').map(row => row.textContent))
    .toEqual(['Everyone✓', 'Paul']);
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  await waitFor(() => expect(screen.queryByTestId('hero-cashier-menu')).toBeNull());
  await payCash();
  const today = within(screen.getByTestId('reports-hero'));
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const [order] = await app.orders.find().exec();
  expect(order.cashierRef).toBe('2');
  await act(async () => { await order.incrementalPatch({ cashierRef: '7' }); });
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('hero-chip-cashier'));
  await screen.findByTestId('hero-cashier-menu');
  expect(screen.queryByTestId('hero-cashier-7')).toBeNull();
  fireEvent.click(screen.getByTestId('hero-cashier-2'));
  expect(text('hero-chip-cashier')).toBe('Paul');
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(text('card-payments-empty')).toBe('No payments in this period');
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.queryAllByTestId(/^sales-table-row-/)).toHaveLength(0);
  expect(table.getByTestId('sales-table-status').textContent).toBe('0 of 0 counted');
  fireEvent.click(table.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  await act(async () => { await order.incrementalPatch({ cashierRef: '2' }); });
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('hero-chip-cashier-clear'));
  expect(text('hero-chip-cashier')).toBe('Everyone');
  expect(screen.queryByTestId('hero-chip-cashier-clear')).toBeNull();
  expect(screen.queryByTestId('hero-cashier-menu')).toBeNull();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
}, 20_000);

test('the scope strip holds the cashier chip and Print summary; the compare chip sits in the hero', async () => {
  await setup();
  const strip = within(screen.getByTestId('reports-scope-strip'));
  expect(strip.getByTestId('hero-chip-cashier')).not.toBeNull();
  expect(strip.getByTestId('reports-print-summary').textContent).toBe('Print summary');
  expect(strip.queryByTestId('hero-chip-compare')).toBeNull();
  expect(within(screen.getByTestId('reports-hero')).getByTestId('hero-chip-compare').textContent).toBe('vs yesterday');
}, 20_000);

/** Presses Print summary and returns what the mounted summary held when `window.print` ran. */
/** Presses the open table's Print report and returns what the print area held when `window.print` ran. */
async function printTable() {
  const printed: { text: string | null; dataPrint: string | null | undefined; heroHidden: boolean; rows: string[] }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const area = screen.queryByTestId('sales-table-print');
    printed.push({ text: area?.textContent ?? null, dataPrint: area?.getAttribute('data-print'),
      heroHidden: screen.getByTestId('reports-hero').closest('[data-print="hide"]') !== null,
      rows: area ? within(area).queryAllByTestId(/^sales-table-print-row-/).map(row => row.textContent ?? '') : [] });
  });
  fireEvent.click(within(screen.getByTestId('sales-table')).getByTestId('detail-panel-print'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  return printed[0];
}

test('each Reports table dialog has Print report after Export CSV (v2 detail-panel-print)', async () => {
  await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  for (const opener of ['card-payments-open', 'card-taxes-open', 'card-where-sold-open', 'sales-room-orders-open', 'card-products-open', 'card-categories-open', 'card-cashiers-open']) {
    fireEvent.click(screen.getByTestId(opener));
    const dialog = await screen.findByTestId('sales-table');
    const footer = Array.from(dialog.querySelectorAll('[data-testid="sales-table-export"], [data-testid="detail-panel-print"], [data-testid="sales-table-close"]'));
    expect(footer.map(button => button.textContent), opener).toEqual(['Export CSV', 'Print report', 'Close']);
    fireEvent.click(within(dialog).getByTestId('sales-table-close'));
    await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  }
}, 20_000);

test('Print report prints the open table: title, scope, every row and the total', async () => {
  const app = await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText(EMPTY_CART_TEXT);
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  fireEvent.click(screen.getByTestId('card-payments-open'));
  await screen.findByTestId('sales-table');
  const printed = await printTable();
  expect(printed.dataPrint).toBe('table');
  expect(printed.heroHidden).toBe(true);
  expect(printed.text).toContain('Sales by payment method');
  expect(printed.text).toContain(stores[0].name);
  expect(text('sales-table-print-scope')).toBe(`Today · ${app.register.registerName}`);
  expect(text('sales-table-print-head')).toBe('Method — Orders — Amount — Share');
  expect(printed.rows).toEqual(['Card terminal — 1 — $4.00 — 66.7%', 'Cash — 1 — $2.00 — 33.3%']);
  expect(text('sales-table-print-total')).toBe('Total — 1 — $6.00');
  expect(printed.text).toMatch(/Printed: .+/);
  expect(screen.queryByTestId('sales-table-print-empty')).toBeNull();
  expect(screen.getByTestId('sales-table')).not.toBeNull();
}, 20_000);

test('Print report stays enabled on an empty table and prints its empty line', async () => {
  await setup();
  fireEvent.click(screen.getByTestId('card-payments-open'));
  const dialog = within(await screen.findByTestId('sales-table'));
  expect(dialog.getByText('No payments in this period')).not.toBeNull();
  expect(dialog.getByTestId('detail-panel-print').getAttribute('aria-disabled')).toBeNull();
  const printed = await printTable();
  expect(printed.dataPrint).toBe('table');
  expect(printed.text).toContain('No payments in this period');
  expect(printed.rows).toEqual([]);
}, 20_000);

async function printSummary() {
  const printed: { text: string | null; dataPrint: string | null | undefined; todayHidden: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const summary = screen.queryByTestId('sales-summary-print');
    printed.push({ text: summary?.textContent ?? null, dataPrint: summary?.getAttribute('data-print'),
      todayHidden: screen.getByTestId('reports-hero').closest('[data-print="hide"]') !== null });
  });
  fireEvent.click(screen.getByTestId('reports-print-summary'));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  return printed[0];
}

test('Print summary prints the shown sales: scope, total, orders and a row per payment method', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const printed = await printSummary();
  expect(printed.dataPrint).toBe('summary');
  expect(printed.todayHidden).toBe(true);
  expect(printed.text).toContain('Sales summary');
  expect(printed.text).toContain(stores[0].name);
  expect(text('sales-summary-scope')).toBe(`Today · ${app.register.registerName} · Everyone`);
  expect(text('sales-summary-total')).toBe('Total sales — 1 — $3.00');
  expect(text('sales-summary-sales-row-orders')).toBe('Orders — 1');
  expect(within(screen.getByTestId('sales-summary-group-payments')).getAllByTestId(/^sales-summary-payments-row-/).map(row => row.textContent))
    .toEqual(['Cash — $3.00']);
  expect(text('sales-summary-payments-subtotal')).toBe('Taken — $3.00');
  expect(text('sales-summary-head')).toBe('Line — Count — Amount');
  expect(printed.text).toMatch(/Printed: .+/);
  expect(screen.queryByTestId('sales-summary-group-taxes')).toBeNull();
  expect(screen.queryByTestId('sales-summary-group-cashiers')).toBeNull();
  expect(screen.queryByTestId('closure-print-document')).toBeNull();
}, 20_000);

test("with a cashier chosen, the summary counts only that cashier's sales", async () => {
  const app = await setup();
  await payCash();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  const [order] = await app.orders.find().exec();
  await act(async () => { await order.incrementalPatch({ cashierRef: '7' }); });
  await choose('cashier', '2');
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  await printSummary();
  expect(text('sales-summary-scope')).toBe(`Today · ${app.register.registerName} · Paul`);
  expect(text('sales-summary-total')).toBe('Total sales — 1 — $3.00');
  expect(text('sales-summary-sales-row-orders')).toBe('Orders — 1');
  expect(text('sales-summary-payments-row-cash')).toBe('Cash — $3.00');
}, 30_000);

test('the summary groups sales by cashier when more than one sold', async () => {
  const app = await setup();
  await payCash();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  const [order] = await app.orders.find().exec();
  await act(async () => { await order.incrementalPatch({ cashierRef: '7' }); });
  await printSummary();
  await waitFor(() => expect(within(screen.getByTestId('sales-summary-group-cashiers')).getAllByTestId(/^sales-summary-cashiers-row-/)).toHaveLength(2));
  expect(text('sales-summary-cashiers-row-2')).toBe('Paul — 1 — $3.00');
  expect(text('sales-summary-cashiers-subtotal')).toBe('Total — 2 — $6.00');
}, 30_000);

test('the summary lists taxes by rate when there is tax', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.30'));
  await printSummary();
  expect(within(screen.getByTestId('sales-summary-group-taxes')).getByText('Tax 10% — $0.30')).not.toBeNull();
  expect(text('sales-summary-taxes-subtotal')).toBe('Tax collected — $0.30');
}, 20_000);

/** Opens the date button's menu and picks a preset. */
async function choosePeriod(preset: string) {
  fireEvent.click(screen.getByTestId('reports-period'));
  fireEvent.click(within(await screen.findByTestId('reports-period-menu')).getByTestId(`reports-period-${preset}`));
  expect(screen.queryByTestId('reports-period-menu')).toBeNull();
}

/** Pays one cash sale per moment, then moves each to its moment. */
async function salesAt(app: Awaited<ReturnType<typeof setup>>, moments: Date[]) {
  for (const _ of moments) await payCash();
  await waitFor(() => expect(text('hero-orders')).toBe(String(moments.length)));
  const docs = await app.orders.find().exec();
  await act(async () => { for (const [i, doc] of docs.entries()) await doc.incrementalPatch({ createdAt: moments[i].toISOString() }); });
}

test('the date menu lists the presets; Yesterday counts only yesterday against the whole day before, and prints it', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    const strip = within(screen.getByTestId('reports-scope-strip'));
    expect(strip.getByTestId('reports-period').textContent).toBe('Today · Tue 6 Oct');
    fireEvent.click(screen.getByTestId('reports-period'));
    expect(within(await screen.findByTestId('reports-period-menu')).getAllByRole('menuitem').map(row => row.textContent))
      .toEqual(['Today✓', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month']);
    fireEvent.click(screen.getByTestId('reports-period-today'));
    await salesAt(app, [new Date(2026, 9, 6, 9, 0), new Date(2026, 9, 5, 10, 0), new Date(2026, 9, 5, 11, 0), new Date(2026, 9, 4, 16, 0)]);
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    await choosePeriod('yesterday');
    expect(text('reports-period')).toBe('Yesterday · Mon 5 Oct');
    await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
    // The day before's 16:00 sale is after now's time of day, and a closed day is compared whole.
    expect(text('hero-delta')).toBe('+100.0% vs yesterday');
    expect(text('hero-orders-delta')).toBe('+1');
    expect(text('hero-chip-compare')).toBe('vs yesterday');
    expect(text('hero-chart-toggle-segment-hour')).toBe('By hour');
    expect(screen.getByTestId('sales-hour-10')).not.toBeNull();
    // A closed day's running total is the amount alone; Today's reads "… now".
    fireEvent.click(screen.getByText('Running total'));
    await waitFor(() => expect(text('hero-chart-total')).toBe('$6.00'));
    fireEvent.click(screen.getByTestId('sales-room-orders-open'));
    const table = within(await screen.findByTestId('sales-table'));
    expect(table.getAllByTestId(/^sales-table-row-/).map(row => within(row).getAllByText(/./)[2].textContent)).toEqual(['11:00', '10:00']);
    expect(table.getByTestId('sales-table-status').textContent).toBe('2 of 2 counted');
    fireEvent.click(table.getByTestId('sales-table-close'));
    await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
    await printSummary();
    expect(text('sales-summary-scope')).toBe(`Yesterday · ${app.register.registerName} · Everyone`);
    expect(text('sales-summary-total')).toBe('Total sales — 2 — $6.00');
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

test('This week counts the week by day against the week before, cut at now on its last day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await salesAt(app, [new Date(2026, 9, 6, 9, 0), new Date(2026, 9, 5, 10, 0), new Date(2026, 8, 28, 10, 0), new Date(2026, 8, 29, 16, 0)]);
    await choosePeriod('thisWeek');
    expect(text('reports-period')).toBe('This week · 5–6 Oct');
    await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
    // Tuesday the week before at 16:00 is after now's 14:30: only Monday's sale is compared.
    expect(text('hero-delta')).toBe('+100.0% vs the week before');
    expect(screen.getByTestId('sales-day-2026-10-05').getAttribute('aria-label')).toMatch(/; last week \$3\.00$/);
    expect(screen.getAllByTestId(/^sales-day-\d{4}-\d\d-\d\d$/).map(column => column.getAttribute('data-testid')))
      .toEqual(['sales-day-2026-10-05', 'sales-day-2026-10-06']);
    expect(text('hero-chart-toggle-segment-hour')).toBe('By day');
    const chip = screen.getByTestId('hero-chip-compare');
    expect(chip.textContent).toBe('vs the week before');
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(chip);
    expect(screen.queryByTestId('hero-compare-menu')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

const runPoints = () => screen.getByTestId('hero-chart-run').getAttribute('points')!.split(' ');

test('Last month is compared with the month before', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await salesAt(app, [new Date(2026, 8, 28, 10, 0), new Date(2026, 7, 10, 10, 0), new Date(2026, 7, 11, 10, 0)]);
    await choosePeriod('lastMonth');
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    // v2 hero/index.tsx:476-481: September against August's two sales, "vs the month before"; chart.tsx:150-158 "last month".
    expect(text('hero-delta')).toBe('−50.0% vs the month before');
    expect(text('hero-chip-compare')).toBe('vs the month before');
    expect(screen.getByTestId('sales-day-2026-09-10').getAttribute('aria-label')).toMatch(/; last month \$3\.00$/);
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

test("Last month's running total runs through a late sale to the month's last day", async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await salesAt(app, [new Date(2026, 8, 28, 10, 0)]);
    await choosePeriod('lastMonth');
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    fireEvent.click(screen.getByText('Running total'));
    // A closed month has no future: the line reaches day 28's sale and the 30th.
    await waitFor(() => expect(text('hero-chart-total')).toBe('$3.00'));
    expect(runPoints()).toHaveLength(30);
    expect(runPoints().slice(26)).toEqual(['26.5,100', '27.5,0', '28.5,0', '29.5,0']);
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

test("This month, live late in the month, runs the line to today's day", async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 14, 30));
  try {
    const app = await setup();
    await salesAt(app, [new Date(2026, 9, 27, 10, 0)]);
    await choosePeriod('thisMonth');
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    fireEvent.click(screen.getByText('Running total'));
    // The range ends today, the 28th: today is the last bucket and none is the future.
    await waitFor(() => expect(text('hero-chart-total')).toBe('$3.00 now'));
    expect(runPoints()).toHaveLength(28);
    expect(screen.queryAllByTestId(/^sales-day-.*-future$/)).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

test('Sales shows the picked custom dates without a preset separator', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    await setup();
    fireEvent.click(screen.getByTestId('reports-period'));
    await screen.findByTestId('reports-period-calendar');
    fireEvent.click(screen.getByTestId('reports-period-calendar-day-2026-10-02'));
    fireEvent.click(screen.getByTestId('reports-period-calendar-day-2026-10-04'));
    fireEvent.click(screen.getByTestId('reports-period-apply'));
    expect(text('reports-period')).toContain('2–4 Oct');
    expect(text('reports-period')).not.toContain('·');
  } finally {
    vi.useRealTimers();
  }
}, 40_000);

function storeConnector(listOrders: TallyConnector['listOrders']) {
  return Object.assign(createWooCommerceConnector(), { listOrders });
}

function storeOrder(over: Partial<StoreOrder>): StoreOrder {
  return { reference: 'store-order', pricesIncludeTax: false, customer: null, lines: [], fees: [], shipping: [],
    coupons: [], taxLines: [], discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, payments: [], refunds: [],
    currency: stores[0].currency, status: 'completed', placedAt: new Date().toISOString(), id: '900', totalMinor: 0, ...over };
}

test("Store scope counts the store's POS orders once the read lands, as v2 does", async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [storeOrder({
    id: '900', totalMinor: 2500, payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 2500 }],
    refunds: [{ id: 'r1', amountMinor: 500 }],
  })], hasMore: false, total: 1 }));
  await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-total')).toBe('$25.00'));
  expect(text('hero-orders')).toBe('1');
  expect(screen.queryByTestId('hero-store-line')).toBeNull();
  expect(text('hero-refunded')).toBe("Refunded: $5.00 · counted on each order's day");
  const at = new Date(); const [y, m, d] = [at.getFullYear(), at.getMonth(), at.getDate()];
  expect(listOrders.mock.calls[0][1]).toMatchObject({
    createdVia: 'woocommerce-pos', dateRange: { after: new Date(y, m, d - 1).toISOString(), before: new Date(y, m, d + 1).toISOString() },
  });
  expect(listOrders.mock.calls[0][1]).not.toHaveProperty('status');
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$28.00'));
  expect(text('hero-orders')).toBe('2');
  await printSummary();
  expect(text('sales-summary-scope')).toBe(`Today · ${stores[0].name} · Everyone`);
  expect(text('sales-summary-sales-row-refunds')).toContain('Refunded');
  expect(text('sales-summary-sales-row-refunds')).toContain('5.00');
  await choose('cashier', '2');
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
}, 20_000);

test("This till shows the till's own sales and no store line", async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [storeOrder({
    id: '900', totalMinor: 2500, payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 2500 }],
    refunds: [{ id: 'r1', amountMinor: 500 }],
  })], hasMore: false, total: 1 }));
  const app = await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-total')).toBe('$25.00'));
  await choose('scope', 'till');
  await waitFor(() => expect(within(screen.getByTestId('reports-hero')).getByText('No sales yet today.')).not.toBeNull());
  expect(screen.queryByTestId('hero-store-line')).toBeNull();
  expect(screen.queryByTestId('hero-refunded')).toBeNull();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  await printSummary();
  expect(text('sales-summary-scope')).toBe(`Today · ${app.register.registerName} · Everyone`);
}, 20_000);

test("a store read that fails keeps the till's figures under a line", async () => {
  const listOrders = vi.fn(async () => { throw new Error('offline'); });
  const app = await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-store-line')).toBe("Store unreachable: this till's sales only"));
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  await printSummary();
  expect(text('sales-summary-scope')).toBe(`Today · ${app.register.registerName} · Everyone`);
}, 20_000);

test('the progress line shows while the store is read', async () => {
  const listOrders = vi.fn(() => new Promise<never>(() => {}));
  await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-store-line')).toBe('Reading store orders 0'));
}, 20_000);

test('under Store, an order left out in the Orders table leaves the store figures, and the table names this till', async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [storeOrder({
    id: '900', totalMinor: 2500, payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 2500 }],
    refunds: [{ id: 'r1', amountMinor: 500 }],
  })], hasMore: false, total: 1 }));
  const app = await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-total')).toBe('$25.00'));
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$28.00'));
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  await screen.findByTestId('sales-table');
  expect(text('sales-table-scope')).toBe(`Today · ${app.register.registerName}`);
  const id = (await app.orders.find().exec())[0].id;
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${id}`));
  await waitFor(() => expect(text('hero-total')).toBe('$25.00'));
  expect(text('hero-orders')).toBe('1');
}, 20_000);

test("under Store, products and categories keep this till's totals and name, and a chosen cashier's print names this till", async () => {
  const listOrders = vi.fn<NonNullable<TallyConnector['listOrders']>>(async () => ({ orders: [storeOrder({
    id: '900', totalMinor: 2500, payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 2500 }],
    refunds: [{ id: 'r1', amountMinor: 500 }],
  })], hasMore: false, total: 1 }));
  const app = await setup({ connector: storeConnector(listOrders) });
  await waitFor(() => expect(text('hero-total')).toBe('$25.00'));
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$28.00'));
  expect(text('card-categories-figure')).toBe('$3.00');
  fireEvent.click(screen.getByTestId('card-categories-open'));
  await screen.findByTestId('sales-table');
  expect(text('sales-table-scope')).toBe(`Today · ${app.register.registerName}`);
  fireEvent.click(screen.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  await choose('cashier', '2');
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  await printSummary();
  expect(text('sales-summary-scope')).toBe(`Today · ${app.register.registerName} · Paul`);
}, 20_000);
