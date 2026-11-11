// Uniwind's runtime does not load under Vitest; the report cards' donut reads fixed colours.
vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() }, useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { orderReference } from '@tallyui/components';
import type { OrderCreateEnvelope, StoreSettings } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import { ReportsScreen } from '../components/reports-screen';
import { SaleScreen } from '../components/sale-screen';
import { drawerResultClass } from '../components/till-strip';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { dayRange } from '../lib/reports/today-sales';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash, takeLeg } from './tender-helpers';
import { sessionsOff, toggleRegisterSessions } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

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
async function choose(name: 'cashier' | 'compare', value: string) {
  fireEvent.click(screen.getByTestId(`hero-chip-${name}`));
  fireEvent.click(within(await screen.findByTestId(`hero-${name}-menu`)).getByTestId(`hero-${name}-${value}`));
  expect(screen.queryByTestId(`hero-${name}-menu`)).toBeNull();
}

async function setup({ multiplePayments, storeSettings = noTaxSettings }: { multiplePayments?: boolean; storeSettings?: StoreSettings } = {}) {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const onBack = vi.fn();
  const view = render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen multiplePayments={multiplePayments} storeSettings={storeSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} locale={stores[0].locale} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
          <ReportsScreen storeName={stores[0].name} currency={stores[0].currency} locale={stores[0].locale} onBack={onBack} />
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
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
}

async function openRegister(enable = true) {
  if (enable) toggleRegisterSessions();
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-checkout');
}

async function closeRegister(counted: string) {
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
  fireEvent.click(await screen.findByTestId('register-panel-close'));
  fireEvent.change(await screen.findByTestId('count-amount'), { target: { value: counted } });
  fireEvent.click(screen.getByTestId('count-close'));
  await screen.findByTestId('closure-print-document');
  fireEvent.click(await screen.findByTestId('closure-done'));
  await waitFor(() => expect(screen.queryByTestId('closure-print-document')).toBeNull());
}

async function movement(type: 'paid-in' | 'paid-out' | 'no-sale', amount: string | null, reason: string) {
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
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
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
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
  const card = within(screen.getByTestId('reports-closures')).getByTestId('reports-session-card');
  expect(card.textContent).toContain('● Open · This till');
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
  expect(screen.queryByTestId('sales-room-hours')).toBeNull();
  const today = within(screen.getByTestId('reports-hero'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(text('card-payments-empty')).toBe('No payments in this period.');
  expect(within(screen.getByTestId('reports-closures')).getByTestId('closures-empty').textContent).toBe('No closures in this period');
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
  expect(screen.queryByTestId('sales-room-taxes')).toBeNull();
  fireEvent.click(screen.getByTestId('reports-back'));
  expect(app.onBack).toHaveBeenCalledOnce();
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
  expect(text('card-payments-empty')).toBe('No payments in this period.');
}, 20_000);

test('the hero chart switches between By hour and Running total', async () => {
  await setup();
  expect(screen.queryByTestId('hero-chart-toggle')).toBeNull();
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
    expect(screen.getByTestId('sales-hour-10').getAttribute('aria-label')).toBe('10:00 — today $0.00, 0 orders; yesterday $3.00');
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
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
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
  expect(within(screen.getByTestId('sales-room-taxes')).getByText('Tax 10% — Net $3.00 — Tax $0.30 — Gross $3.30')).not.toBeNull();
}, 20_000);

test('Closures lists real counted closures newest first', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('103.00');
  const room = within(screen.getByTestId('reports-closures'));
  await waitFor(() => expect(room.getAllByTestId(/^closure-title-/)).toHaveLength(1));
  const first = app.register.lastClosure!;
  expect(room.getByTestId(`closure-title-${first.id}`).textContent).toBe('Closure 1 · This till');
  expect(room.getByTestId(`closure-expected-${first.id}`).textContent).toBe('$103.00');
  expect(room.getByTestId(`closure-counted-${first.id}`).textContent).toBe('$103.00');
  expect(room.getByTestId(`closure-difference-${first.id}`).textContent).toBe('$0.00');
  expect(room.getByTestId(`closure-result-${first.id}`).textContent).toBe('Exact');
  await openRegister(false);
  await closeRegister('100.00');
  await waitFor(() => expect(room.getAllByTestId(/^closure-title-/).map(row => row.textContent)).toEqual(['Closure 2 · This till', 'Closure 1 · This till']));
}, 20_000);

test('Reprint prints the mounted Copy document once without changing the closure', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  expect(screen.queryByTestId('x-report-print')).toBeNull();
  const closure = app.register.lastClosure!;
  const collection = app.orders.database.collections.closures;
  const before = (await collection.findOne(closure.id).exec())!.toJSON();
  const printedDocuments: { text: string | null; dataPrint: string | null | undefined; todayHidden: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const document = screen.queryByTestId('closure-print-document');
    printedDocuments.push({ text: document?.textContent ?? null, dataPrint: document?.getAttribute('data-print'),
      todayHidden: screen.getByTestId('reports-hero').closest('[data-print="hide"]') !== null });
  });
  fireEvent.click(await screen.findByTestId(`closure-reprint-${closure.id}`));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0].dataPrint).toBe('closure');
  expect(printedDocuments[0].todayHidden).toBe(true);
  expect(printedDocuments[0].text).toContain('Closure #1');
  expect(printedDocuments[0].text).toContain('Copy');
  expect(printedDocuments[0].text).toContain('Counted: $100.00');
  expect(screen.getByTestId('closure-print-document').textContent).toContain('Copy');
  fireEvent.click(screen.getByTestId(`closure-reprint-${closure.id}`));
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
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
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
  const printedDocuments: { text: string | null; dataPrint: string | null; todayHidden: boolean; opened: boolean }[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const report = screen.getByTestId('closure-print-document');
    printedDocuments.push({ text: report.textContent, dataPrint: report.getAttribute('data-print'), opened: within(report).queryByText(/^Opened: .+ Paul$/) !== null,
      todayHidden: screen.getByTestId('reports-hero').closest('[data-print="hide"]') !== null });
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
  expect(printedDocuments[0].text).toContain('Register: This till');
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
  expect(anchors[0].download).toMatch(/^closures-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(anchors[0].href).toBe('blob:closures-test');
  expect(anchors[0].isConnected).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:closures-test');
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
  await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
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
  expect(table.getByTestId('sales-table-scope').textContent).toBe('Today · This till');
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
    expect(table.getByText('No sales yet today.')).not.toBeNull();
    expect(table.getByTestId('sales-table-status').textContent).toBe('0 orders · $0.00');
  });
  expect(screen.getByTestId('sales-table')).not.toBeNull();
}, 20_000);

test('the Taxes tile opens a table of rates', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.30'));
  fireEvent.click(screen.getByTestId('sales-room-taxes-open'));
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
  expect(within(table.getByTestId(`sales-table-row-${order.id}`)).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    orderReference(order), time, 'Cash', '$3.00',
  ]);
  expect(within(table.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Total', '$3.00',
  ]);
  expect(table.getByTestId('sales-table-status').textContent).toBe('1 order · $3.00');
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
    expect(table.getByText('No sales yet today.')).not.toBeNull();
    expect(table.getByTestId('sales-table-status').textContent).toBe('0 orders · $0.00');
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
  expect((await blob.text()).split('\r\n')[1]).toBe(`"${orderReference(order)}","${time}","Cash","$3.00"`);
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
    expect(text('hero-chip-compare')).toBe('vs yesterday▾');
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
    expect(screen.getByTestId('sales-hour-10').getAttribute('aria-label')).toBe('10:00 — today $0.00, 0 orders; last Tuesday $3.00');
    expect(text('hero-chip-compare')).toBe('vs last Tuesday▾');
    await choose('compare', 'yesterday');
    await waitFor(() => expect(text('hero-delta')).toBe('—'));
    expect(text('hero-orders-delta')).toBe('—');
  } finally {
    vi.useRealTimers();
  }
}, 20_000);

test('the cashier chip narrows every period figure to one cashier', async () => {
  const app = await setup();
  expect(text('hero-chip-cashier')).toBe('Everyone▾');
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
  expect(text('hero-chip-cashier')).toBe('Paul▾');
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(text('card-payments-empty')).toBe('No payments in this period.');
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(table.queryAllByTestId(/^sales-table-row-/)).toHaveLength(0);
  expect(table.getByTestId('sales-table-status').textContent).toBe('0 orders · $0.00');
  fireEvent.click(table.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  await act(async () => { await order.incrementalPatch({ cashierRef: '2' }); });
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  fireEvent.click(screen.getByTestId('hero-chip-cashier-clear'));
  expect(text('hero-chip-cashier')).toBe('Everyone▾');
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
  expect(within(screen.getByTestId('reports-hero')).getByTestId('hero-chip-compare').textContent).toBe('vs yesterday▾');
}, 20_000);

/** Presses Print summary and returns what the mounted summary held when `window.print` ran. */
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
  await setup();
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
  const printed = await printSummary();
  expect(printed.dataPrint).toBe('summary');
  expect(printed.todayHidden).toBe(true);
  expect(printed.text).toContain('Sales summary');
  expect(printed.text).toContain(stores[0].name);
  expect(text('sales-summary-scope')).toBe('Today · This till · Everyone');
  expect(text('sales-summary-total')).toBe('Total sales: $3.00');
  expect(text('sales-summary-orders')).toBe('Orders: 1');
  expect(within(screen.getByTestId('sales-summary-payments')).getAllByTestId(/^sales-summary-payment-/).map(row => row.textContent))
    .toEqual(['Cash — 1 — $3.00']);
  expect(printed.text).toMatch(/Printed: .+/);
  expect(screen.queryByTestId('sales-summary-taxes')).toBeNull();
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
  expect(text('sales-summary-scope')).toBe('Today · This till · Paul');
  expect(text('sales-summary-total')).toBe('Total sales: $3.00');
  expect(text('sales-summary-orders')).toBe('Orders: 1');
  expect(text('sales-summary-payment-cash')).toBe('Cash — 1 — $3.00');
}, 30_000);

test('the summary lists taxes by rate when there is tax', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  await waitFor(() => expect(text('hero-total')).toBe('$3.30'));
  await printSummary();
  expect(within(screen.getByTestId('sales-summary-taxes')).getByText('Tax 10% — Net $3.00 — Tax $0.30 — Gross $3.30')).not.toBeNull();
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
    expect(strip.getByTestId('reports-period').textContent).toBe('Today · Tue 6 Oct▾');
    fireEvent.click(screen.getByTestId('reports-period'));
    expect(within(await screen.findByTestId('reports-period-menu')).getAllByRole('menuitem').map(row => row.textContent))
      .toEqual(['Today✓', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month']);
    fireEvent.click(screen.getByTestId('reports-period-today'));
    await salesAt(app, [new Date(2026, 9, 6, 9, 0), new Date(2026, 9, 5, 10, 0), new Date(2026, 9, 5, 11, 0), new Date(2026, 9, 4, 16, 0)]);
    await waitFor(() => expect(text('hero-total')).toBe('$3.00'));
    await choosePeriod('yesterday');
    expect(text('reports-period')).toBe('Yesterday · Mon 5 Oct▾');
    await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
    // The day before's 16:00 sale is after now's time of day, and a closed day is compared whole.
    expect(text('hero-delta')).toBe('+100.0% vs yesterday');
    expect(text('hero-orders-delta')).toBe('+1');
    expect(text('hero-chip-compare')).toBe('vs yesterday▾');
    expect(text('hero-chart-toggle-segment-hour')).toBe('By hour');
    expect(screen.getByTestId('sales-hour-10')).not.toBeNull();
    // A closed day's running total is the amount alone; Today's reads "… now".
    fireEvent.click(screen.getByText('Running total'));
    await waitFor(() => expect(text('hero-chart-total')).toBe('$6.00'));
    fireEvent.click(screen.getByTestId('sales-room-orders-open'));
    const table = within(await screen.findByTestId('sales-table'));
    expect(table.getAllByTestId(/^sales-table-row-/).map(row => within(row).getAllByText(/./)[1].textContent)).toEqual(['11:00', '10:00']);
    expect(table.getByTestId('sales-table-status').textContent).toBe('2 orders · $6.00');
    fireEvent.click(table.getByTestId('sales-table-close'));
    await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
    await printSummary();
    expect(text('sales-summary-scope')).toBe('Yesterday · This till · Everyone');
    expect(text('sales-summary-total')).toBe('Total sales: $6.00');
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
    expect(text('reports-period')).toBe('This week · 5–6 Oct▾');
    await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
    // Tuesday the week before at 16:00 is after now's 14:30: only Monday's sale is compared.
    expect(text('hero-delta')).toBe('+100.0% vs week before');
    expect(screen.getAllByTestId(/^sales-day-\d{4}-\d\d-\d\d$/).map(column => column.getAttribute('data-testid')))
      .toEqual(['sales-day-2026-10-05', 'sales-day-2026-10-06']);
    expect(text('hero-chart-toggle-segment-hour')).toBe('By day');
    const chip = screen.getByTestId('hero-chip-compare');
    expect(chip.textContent).toBe('vs week before');
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(chip);
    expect(screen.queryByTestId('hero-compare-menu')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
}, 40_000);
