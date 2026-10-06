import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { ClosurePrint } from '../components/closure-print';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
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
  const view = render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} locale={stores[0].locale} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { ...view, get register() { return register; }, orders: outbox.orders, send };
}

async function payCash() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = await screen.findByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '10.00' } });
  fireEvent.click(complete);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}

async function openRegister() {
  fireEvent.click(screen.getByRole('switch', { name: 'Use register sessions' }));
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByRole('button', { name: 'Cash' });
}

async function closeRegister(counted: string) {
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
  fireEvent.click(await screen.findByTestId('register-panel-close'));
  fireEvent.change(await screen.findByTestId('count-amount'), { target: { value: counted } });
  fireEvent.click(screen.getByTestId('count-close'));
  await screen.findByTestId('closure-print');
  await screen.findByTestId('closure-print-document');
}

test('ClosurePrint renders the figures from a real float, paid-out movement and sale', async () => {
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
  await waitFor(() => expect(app.register.salesCount).toBe(1));
  await closeRegister('83.00');
  const closure = app.register.lastClosure!;
  app.unmount();
  render(<ClosurePrint closure={closure} storeName={stores[0].name} currency="USD" locale="en_US" />);
  const root = screen.getByTestId('closure-print-document');
  const report = within(root);
  expect(root.textContent).toContain(stores[0].name);
  expect(root.textContent).toContain('Closure #1');
  expect(report.getByText('Register: This till')).not.toBeNull();
  expect(root.textContent).not.toContain(closure.register_id);
  expect(report.getByText(/^Opened:/).textContent).toMatch(/ Paul$/);
  expect(report.getByText(/^Closed:/).textContent).toMatch(/ Paul$/);
  expect(report.getByText('Cashiers: Paul')).not.toBeNull();
  expect(report.queryByText(/^(Opened|Closed|Cashiers):.*\b2$/)).toBeNull();
  expect(report.queryByText(/^Approver:/)).toBeNull();
  expect(report.queryAllByText(/:\s*$/)).toHaveLength(0);
  expect(report.getByText('Counted: $100.00')).not.toBeNull();
  expect(report.getByText(/Paid out: \$20\.00 — Milk/)).not.toBeNull();
  expect(report.getByText('Expected: $83.00')).not.toBeNull();
  expect(report.getByText('Counted: $83.00')).not.toBeNull();
  expect(report.getByText('Expected: $83.00').parentElement!.textContent).toContain('Variance: $0.00');
  expect(report.getByText('Period sales: $3.00')).not.toBeNull();
  expect(report.getByText('Transactions: 1')).not.toBeNull();
  const dates = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', hour12: false });
  expect(report.getByText(/^Opened:/).textContent).toContain(dates.format(new Date(closure.opened_at)));
  expect(report.getByText(/^Closed:/).textContent).toContain(dates.format(new Date(closure.closed_at)));
  expect(getComputedStyle(root).display).toBe('none');
}, 20_000);

test('the closure sheet prints once with the complete document already in the DOM', async () => {
  await setup();
  await openRegister();
  await closeRegister('100.00');
  const printedDocuments: (HTMLElement | null)[] = [];
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printedDocuments.push(screen.queryByTestId('closure-print-document'));
  });
  fireEvent.click(screen.getByTestId('closure-print'));
  expect(print).toHaveBeenCalledTimes(1);
  const [printedDocument] = printedDocuments;
  expect(printedDocument).not.toBeNull();
  expect(printedDocument!.textContent).toContain(stores[0].name);
  expect(printedDocument!.textContent).toContain('Closure #1');
  expect(printedDocument!.textContent).toContain('Counted: $100.00');
  expect(printedDocument!.getAttribute('data-print')).toBe('closure');
  await waitFor(() => expect(screen.getByTestId('closure-print').getAttribute('aria-disabled')).not.toBe('true'));
  fireEvent.click(screen.getByTestId('closure-done'));
  await waitFor(() => expect(screen.queryByTestId('closure-print-document')).toBeNull());
}, 20_000);

test('a closure without sales prints no Sales section', async () => {
  const app = await setup();
  await openRegister();
  await closeRegister('100.00');
  const closure = app.register.lastClosure!;
  app.unmount();
  render(<ClosurePrint closure={closure} storeName={stores[0].name} currency="USD" />);
  const report = within(screen.getByTestId('closure-print-document'));
  expect(report.queryByText('Sales')).toBeNull();
  expect(report.queryByText(/^Period sales:/)).toBeNull();
  expect(report.queryByText(/^Period refunds:/)).toBeNull();
  expect(report.queryByText(/^Transactions:/)).toBeNull();
  expect(report.queryByText(/^Refunds:/)).toBeNull();
  expect(report.queryAllByText(/^Payment method:/)).toHaveLength(0);
  expect(report.getByText('Perpetual sales: $0.00')).not.toBeNull();
  expect(report.getByText('Perpetual refunds: $0.00')).not.toBeNull();
  expect(report.queryByText(/^Approver:/)).toBeNull();
  expect(report.queryByText(/^Cashiers:/)).toBeNull();
  expect(report.queryAllByText(/:\s*$/)).toHaveLength(0);
}, 20_000);
