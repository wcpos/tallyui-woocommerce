import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
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

async function setup() {
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
          <SaleScreen connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
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
  const today = within(screen.getByTestId('reports-today'));
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(within(screen.getByTestId('reports-closures')).getByText('No closures yet. A closure appears here when a register session closes.')).not.toBeNull();
  await payCash();
  await waitFor(() => expect(today.getByText('Sales today: 1')).not.toBeNull());
  expect(today.getByText('Total: $3.00')).not.toBeNull();
  expect(today.getByText('Cash — 1 — $3.00')).not.toBeNull();
  expect(today.queryByText('No sales yet today.')).toBeNull();
  expect(today.queryByText(/^Tax:/)).toBeNull();
  fireEvent.click(screen.getByTestId('reports-back'));
  expect(app.onBack).toHaveBeenCalledOnce();
}, 20_000);

test('Today removes a sale when its createdAt moves to yesterday', async () => {
  const app = await setup();
  await payCash();
  const today = within(screen.getByTestId('reports-today'));
  await waitFor(() => expect(today.getByText('Sales today: 1')).not.toBeNull());
  const [order] = await app.orders.find().exec();
  const createdAt = new Date(Date.parse(dayRange(new Date()).startIso) - 60_000).toISOString();
  await act(async () => { await order.incrementalPatch({ createdAt }); });
  await waitFor(() => expect(today.getByText('Sales today: 0')).not.toBeNull());
  expect(today.getByText('No sales yet today.')).not.toBeNull();
  expect(today.queryByText(/^Cash —/)).toBeNull();
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
  const closure = app.register.lastClosure!;
  const collection = app.orders.database.collections.closures;
  const before = (await collection.findOne(closure.id).exec())!.toJSON();
  const printedDocuments: (string | null)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    const document = screen.queryByTestId('closure-print-document');
    printedDocuments.push(document?.textContent ?? null);
    expect(document?.getAttribute('data-print')).toBe('closure');
    expect(screen.getByTestId('reports-today').closest('[data-print="hide"]')).not.toBeNull();
  });
  fireEvent.click(await screen.findByTestId(`closure-reprint-${closure.id}`));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(printedDocuments[0]).toContain('Closure #1');
  expect(printedDocuments[0]).toContain('Copy');
  expect(printedDocuments[0]).toContain('Counted: $100.00');
  expect(screen.getByTestId('closure-print-document').textContent).toContain('Copy');
  fireEvent.click(screen.getByTestId(`closure-reprint-${closure.id}`));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  expect(printedDocuments[1]).toContain('Copy');
  expect((await collection.findOne(closure.id).exec())!.toJSON()).toEqual(before);
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
