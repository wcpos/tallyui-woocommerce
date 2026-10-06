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
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { dayRange } from '../lib/reports/today-sales';
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
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = await screen.findByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '10.00' } });
  fireEvent.click(complete);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
}

async function openRegister(enable = true) {
  if (enable) fireEvent.click(screen.getByRole('switch', { name: 'Use register sessions' }));
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByRole('button', { name: 'Cash' });
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

test('Today starts empty and observes an Espresso cash sale', async () => {
  const app = await setup();
  expect(screen.queryByTestId('sales-room-hours')).toBeNull();
  const today = within(screen.getByTestId('reports-today'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(screen.queryByTestId('sales-room-payments')).toBeNull();
  expect(within(screen.getByTestId('reports-closures')).getByText('No closures yet. A closure appears here when a register session closes.')).not.toBeNull();
  expect(screen.queryByTestId('x-report-print')).toBeNull();
  expect(screen.queryByTestId('closures-csv')).toBeNull();
  await payCash();
  await waitFor(() => expect(today.getByText('Total: $3.00')).not.toBeNull());
  expect(today.getByText('Orders: 1 (+1)')).not.toBeNull();
  expect(today.getByText('Average order: $3.00 (+$3.00)')).not.toBeNull();
  expect(within(screen.getByTestId('sales-room-payments')).getByText('Cash · 1 order · $3.00')).not.toBeNull();
  expect(screen.queryByText(/^Split tenders/)).toBeNull();
  expect(today.queryByText('No sales yet today.')).toBeNull();
  expect(screen.queryByTestId('sales-room-taxes')).toBeNull();
  fireEvent.click(screen.getByTestId('reports-back'));
  expect(app.onBack).toHaveBeenCalledOnce();
}, 20_000);

test('Today removes a sale when its createdAt moves to yesterday', async () => {
  const app = await setup();
  await payCash();
  const today = within(screen.getByTestId('reports-today'));
  await waitFor(() => expect(today.getByText('Total: $3.00')).not.toBeNull());
  const [order] = await app.orders.find().exec();
  const createdAt = new Date(Date.parse(dayRange(new Date()).startIso) - 60_000).toISOString();
  await act(async () => { await order.incrementalPatch({ createdAt }); });
  await waitFor(() => expect(today.getByText('Total: $0.00')).not.toBeNull());
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(screen.queryByTestId('sales-room-payments')).toBeNull();
}, 20_000);

test('the hero compares with yesterday up to the same time', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 14, 30));
  try {
    const app = await setup();
    await payCash();
    const today = within(screen.getByTestId('reports-today'));
    await waitFor(() => expect(today.getByText('Total: $3.00')).not.toBeNull());
    const [order] = await app.orders.find().exec();
    await act(async () => { await order.incrementalPatch({ createdAt: new Date(2026, 9, 5, 10, 0).toISOString() }); });
    await waitFor(() => expect(today.getByText('Total: $0.00')).not.toBeNull());
    expect(today.getByText('Yesterday by now: $3.00')).not.toBeNull();
    expect(today.getByText('Change: −$3.00 · −100.0%')).not.toBeNull();
    expect(today.getByText('Orders: 0 (−1)')).not.toBeNull();
    expect(today.getByText('Average order: $0.00 (−$3.00)')).not.toBeNull();
    expect(screen.getByTestId('sales-hour-10').getAttribute('aria-label')).toBe('10:00 — today $0.00, 0 orders; yesterday $3.00');
    expect(screen.queryByText(/^Busiest hour/)).toBeNull();
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
    const today = within(screen.getByTestId('reports-today'));
    await waitFor(() => expect(today.getByText('Total: $3.00')).not.toBeNull());
    const [order] = await app.orders.find().exec();
    await act(async () => { await order.incrementalPatch({ createdAt: new Date(2026, 9, 5, 16, 0).toISOString() }); });
    await waitFor(() => expect(today.getByText('Total: $0.00')).not.toBeNull());
    expect(today.getByText('Yesterday by now: $0.00')).not.toBeNull();
    expect(today.getByText('Change: $0.00 · —')).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
}, 20_000);

test('a split tender counts once per method', async () => {
  await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByTestId('split-tender-method-card'));
  expect((screen.getByLabelText('Tender amount') as HTMLInputElement).value).toBe('4.00');
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
  const today = within(screen.getByTestId('reports-today'));
  await waitFor(() => expect(today.getByText('Total: $6.00')).not.toBeNull());
  const payments = within(screen.getByTestId('sales-room-payments'));
  expect(payments.getByText('Cash · 1 order · $2.00')).not.toBeNull();
  expect(payments.getByText('Card terminal · 1 order · $4.00')).not.toBeNull();
  expect(payments.getByText('Split tenders: 1')).not.toBeNull();
}, 20_000);

test('taxes by rate', async () => {
  await setup({ storeSettings: { ...noTaxSettings, taxRatesPpm: { default: 100000 } } });
  await payCash();
  const today = within(screen.getByTestId('reports-today'));
  await waitFor(() => expect(today.getByText('Total: $3.30')).not.toBeNull());
  expect(within(screen.getByTestId('sales-room-taxes')).getByText('Tax 10% — Net $3.00 — Tax $0.30 — Gross $3.30')).not.toBeNull();
}, 20_000);

test('Closures lists real counted closures newest first', async () => {
  const app = await setup();
  await openRegister();
  await payCash();
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('103.00');
  const room = within(screen.getByTestId('reports-closures'));
  await waitFor(() => expect(room.getByText('Closure #1')).not.toBeNull());
  expect(room.getByText('Cash counted: $103.00')).not.toBeNull();
  expect(room.getByText('Variance: $0.00')).not.toBeNull();
  expect(room.getByText('Period sales: $3.00')).not.toBeNull();
  await openRegister(false);
  await closeRegister('100.00');
  await waitFor(() => expect(room.getAllByText(/^Closure #/).map(row => row.textContent)).toEqual(['Closure #2', 'Closure #1']));
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
      todayHidden: screen.getByTestId('reports-today').closest('[data-print="hide"]') !== null });
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
      todayHidden: screen.getByTestId('reports-today').closest('[data-print="hide"]') !== null });
  });
  const button = screen.getByTestId('x-report-print');
  expect(button.textContent).toBe('Print X report');
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

test('Download CSV downloads the listed closures and revokes its object URL', async () => {
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
  expect(button.textContent).toBe('Download CSV');
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

test('CatalogueView exposes Reports only when an onOpenReports handler is supplied', () => {
  const props = { connector: createWooCommerceConnector(), currency: stores[0].currency, products,
    storeName: stores[0].name, cashierName: 'Paul', status: 'ready' as const, onSignOut: () => {} };
  const onOpenReports = vi.fn();
  const { rerender } = render(<CatalogueView {...props} onOpenReports={onOpenReports} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
  expect(onOpenReports).toHaveBeenCalledOnce();
  rerender(<CatalogueView {...props} />);
  expect(screen.queryByRole('button', { name: 'Reports' })).toBeNull();
}, 20_000);

test('the Payments tile opens a table of methods', async () => {
  await setup({ multiplePayments: true });
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByTestId('split-tender-method-card'));
  expect((screen.getByLabelText('Tender amount') as HTMLInputElement).value).toBe('4.00');
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await screen.findByText('Scan or tap a product to start a sale.');
  await waitFor(() => expect(within(screen.getByTestId('reports-today')).getByText('Total: $6.00')).not.toBeNull());
  fireEvent.click(screen.getByTestId('sales-room-payments-open'));
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
  expect(within(screen.getByTestId('sales-room-payments')).getByText('Cash · 1 order · $2.00')).not.toBeNull();
}, 20_000);

test('an open table follows live data', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(within(screen.getByTestId('reports-today')).getByText('Total: $3.00')).not.toBeNull());
  fireEvent.click(screen.getByTestId('sales-room-payments-open'));
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
  await waitFor(() => expect(within(screen.getByTestId('reports-today')).getByText('Total: $3.30')).not.toBeNull());
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
  const today = within(screen.getByTestId('reports-today'));
  await waitFor(() => expect(today.getByText('Total: $3.00')).not.toBeNull());
  const [order] = await app.orders.find().exec();
  const date = new Date(order.createdAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
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
  expect(today.getByText('Orders: 1 (+1)')).not.toBeNull();
}, 20_000);

test('an open Orders table follows live data', async () => {
  const app = await setup();
  await payCash();
  await waitFor(() => expect(within(screen.getByTestId('reports-today')).getByText('Total: $3.00')).not.toBeNull());
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
