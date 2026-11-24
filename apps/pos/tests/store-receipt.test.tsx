import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope, ReceiptTemplate } from '@tallyui/core';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { Text } from '@tallyui/components';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { ReceiptPrintSheet } from '../components/receipt-print-sheet';
import { StoreReceipt } from '../components/store-receipt';
import { ReceiptTemplateRow } from '../components/receipt-template-row';
import { classesOf } from './classes-of';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { pickReceiptTemplate, receiptStoreTax, receiptTemplateIdFor, renderedStoreReceipt, type StoreReceiptTax } from '../lib/receipts/store-receipt';
import { saveReceiptSettings } from '../lib/receipts/receipt-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { EMPTY_CART_TEXT } from './cart-line-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

const html = (id: string, body: string): ReceiptTemplate => ({ id, kind: 'receipt', title: id, engine: 'html', dataModel: 'wcpos', body });
const thermal = (id: string, body: string): ReceiptTemplate => ({ id, kind: 'receipt', title: id, engine: 'thermal', paper: '80mm', dataModel: 'wcpos', body });
const marked = html('g12', '<h1>{{store.name}}</h1><p>G12-MARKER</p>{{#lines}}<p>{{name}}</p>{{/lines}}');

const order: PosOrder = {
  id: 'order-1', createdAt: '2026-11-17T10:00:00Z', currency: 'USD', pricesIncludeTax: false,
  lines: [{ id: 'l1', productId: '80', name: 'Espresso', sku: 'ESP', quantity: 1, unitPriceMinor: 300,
    discountMinor: 0, netMinor: 300, taxLines: [] } as PosOrder['lines'][number]],
  subtotalMinor: 300, discountMinor: 0, taxMinor: 0, totalMinor: 300,
  payments: [{ id: 'p1', method: 'cash', amountMinor: 300 }], customer: null,
  taxRounding: { granularity: 'per_order', mode: 'half_away_from_zero' },
} as PosOrder;
const context = { config: { storeName: 'G12 Store', cashier: 'Paul' }, pricesIncludeTax: false };

const second = html('second', '<h1>{{store.name}}</h1><p>SECOND-MARKER</p>');

test("the store receipt prints the store's tax display, single and incl, and hides the breakdown when taxes are off", () => {
  const t = html('tax', '<p>TAX:{{tax.breakdown}}:{{tax.display}}</p>');
  const renderTax = (tax: StoreReceiptTax | undefined) => renderedStoreReceipt(
    { status: 'ready', templates: [t] }, { kind: 'pos', order }, { ...context, store: receiptStoreTax(tax) });
  expect(renderTax({ taxTotalDisplay: 'single', taxDisplayCart: 'incl', calcTaxes: true })).toContain('TAX:single:incl');
  expect(renderTax({ taxTotalDisplay: 'itemized', taxDisplayCart: 'excl', calcTaxes: false })).toContain('TAX:hidden:excl');
  expect(renderTax(undefined)).toContain('TAX:itemized:excl');
  expect(renderTax({})).toContain('TAX:itemized:excl');
  expect(receiptStoreTax({ taxTotalDisplay: undefined, calcTaxes: false })).toEqual({ calcTaxes: false });
});

test('pickReceiptTemplate takes the selected template, else the first in the connector order, or none', () => {
  expect(pickReceiptTemplate([marked, second])).toBe(marked);
  expect(pickReceiptTemplate([marked, second], 'second')).toBe(second);
  expect(pickReceiptTemplate([marked, second], 'gone')).toBe(marked);
  expect(pickReceiptTemplate([], 'second')).toBeNull();
});

// v2 keys the pick on the order (use-template-renderer.ts:267-285).
test('receiptTemplateIdFor honours a pick only for the order it was made for', () => {
  expect(receiptTemplateIdFor({ orderId: 'order-1', id: 'second' }, 'order-1')).toBe('second');
  expect(receiptTemplateIdFor({ orderId: 'order-1', id: 'second' }, 'order-2')).toBeNull();
  expect(receiptTemplateIdFor(null, 'order-1')).toBeNull();
});

test('renderedStoreReceipt renders the selected template', () => {
  const out = renderedStoreReceipt({ status: 'ready', templates: [marked, second] }, { kind: 'pos', order }, context, 'second');
  expect(out).toContain('SECOND-MARKER');
  expect(out).not.toContain('G12-MARKER');
});

test('renderedStoreReceipt is null while loading, after an error, with no templates, and when the render throws', () => {
  const sale = { kind: 'pos', order } as const;
  expect(renderedStoreReceipt({ status: 'loading' }, sale, context)).toBeNull();
  expect(renderedStoreReceipt({ status: 'error', message: 'down' }, sale, context)).toBeNull();
  expect(renderedStoreReceipt({ status: 'ready', templates: [] }, sale, context)).toBeNull();
  expect(renderedStoreReceipt({ status: 'ready', templates: [{ ...marked, kind: 'report' }] }, sale, context)).toBeNull();
});

test('renderedStoreReceipt renders an html template with the store name and the line name', () => {
  const out = renderedStoreReceipt({ status: 'ready', templates: [marked] }, { kind: 'pos', order }, context);
  expect(out).toContain('G12 Store');
  expect(out).toContain('Espresso');
  expect(out).toContain('G12-MARKER');
});

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

// The receipt stage needs a session (for the templates) and the order outbox (for a tender), as tender-receipt.test.
async function sellEspresso(receiptTemplates: () => Promise<ReceiptTemplate[]>, storeTax: StoreReceiptTax | undefined = undefined) {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async () => ({ kind: 'retry', reason: 'network' }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} storeTax={storeTax} connector={{ ...createWooCommerceConnector(), receiptTemplates }} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
}

test("the receipt stage passes the store's tax display to the store template", async () => {
  const t = html('tax', '<p>TAX:{{tax.breakdown}}:{{tax.display}}</p>');
  await sellEspresso(async () => [t], { taxTotalDisplay: 'single', taxDisplayCart: 'incl', calcTaxes: true });
  const frame = await screen.findByTestId('store-receipt-frame');
  expect(frame.getAttribute('srcdoc')).toContain('TAX:single:incl');
}, 20_000);

test("the receipt stage shows the store's template in a sandboxed frame, and its done button starts a new sale", async () => {
  const receiptTemplates = vi.fn(async () => [marked]);
  await sellEspresso(receiptTemplates);
  const frame = await screen.findByTestId('store-receipt-frame');
  expect(receiptTemplates).toHaveBeenCalledTimes(1);
  expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
  expect(frame.getAttribute('srcdoc')).toContain('G12-MARKER');
  expect(frame.getAttribute('srcdoc')).toContain('Espresso');
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.queryByTestId('receipt-identity')).toBeNull();
  expect(screen.getByTestId('store-receipt-done').textContent).toBe('New sale');
  fireEvent.click(screen.getByTestId('store-receipt-done'));
  await waitFor(() => expect(screen.queryByTestId('store-receipt-frame')).toBeNull());
  expect(screen.getByText(EMPTY_CART_TEXT)).not.toBeNull();
}, 20_000);

test('the receipt stage holds auto print until the store template has loaded', async () => {
  saveReceiptSettings({ autoPrint: true, autoShow: true });
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  let resolve!: (t: ReceiptTemplate[]) => void;
  const pending = new Promise<ReceiptTemplate[]>(r => { resolve = r; });
  await sellEspresso(() => pending);
  await screen.findByTestId('receipt-order');
  expect(screen.queryByTestId('receipt-template-row')).toBeNull();
  expect(print).not.toHaveBeenCalled();
  resolve([marked]);
  const frame = await screen.findByTestId('store-receipt-frame');
  fireEvent.load(frame);
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
}, 20_000);

test('when the templates cannot be read, the receipt stage keeps the built-in receipt', async () => {
  await sellEspresso(async () => { throw new Error('templates down'); });
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(screen.queryByTestId('store-receipt-frame')).toBeNull();
  expect(screen.queryByTestId('receipt-template-row')).toBeNull();
}, 20_000);

test('with no store templates the receipt keeps the built-in receipt and no Template row', async () => {
  await sellEspresso(async () => []);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(screen.queryByTestId('store-receipt-frame')).toBeNull();
  expect(screen.queryByTestId('receipt-template-row')).toBeNull();
}, 20_000);

// v2's Template row (receipt-body.tsx:84-98, template-switcher.tsx:28-84): a select only when there is a choice.
test('with two store templates the receipt shows a Template select on the first, and picking the second re-renders the frame with it', async () => {
  await sellEspresso(async () => [marked, second]);
  const frame = await screen.findByTestId('store-receipt-frame');
  expect(within(screen.getByTestId('receipt-template-row')).getByText('Template')).not.toBeNull();
  expect(screen.getByTestId('receipt-template-select').textContent).toBe('g12');
  expect(frame.getAttribute('srcdoc')).toContain('G12-MARKER');
  fireEvent.click(screen.getByTestId('receipt-template-select'));
  fireEvent.click(screen.getByTestId('receipt-template-second'));
  await waitFor(() => expect(screen.getByTestId('store-receipt-frame').getAttribute('srcdoc')).toContain('SECOND-MARKER'));
  expect(screen.getByTestId('store-receipt-frame').getAttribute('srcdoc')).not.toContain('G12-MARKER');
  expect(screen.getByTestId('receipt-template-select').textContent).toBe('second');
}, 20_000);

// v2's PropertyRow (property-row/index.tsx:103,147-163): key · value on one line off a phone, stacked on a phone.
test('the Template row keeps one line off a phone and stacks the key above the select on a phone', () => {
  const row = () => render(<ReceiptTemplateRow templates={[marked, second]} selectedId="g12" onSelect={() => {}} />);
  row();
  expect(classesOf('receipt-template-row')).toEqual(expect.arrayContaining(['flex-row', 'items-center']));
  cleanup();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  row();
  expect(classesOf('receipt-template-row')).not.toContain('flex-row');
  expect(screen.getByTestId('receipt-template-select').textContent).toBe('g12');
});

test('with HTML templates the Printer row names the browser dialog without a mismatch note', () => {
  render(<ReceiptTemplateRow templates={[marked, second]} selectedId="g12" onSelect={() => {}} />);
  expect(within(screen.getByTestId('receipt-printer-row')).getByText('Printer')).not.toBeNull();
  expect(screen.getByTestId('receipt-printer-value').textContent).toBe('Browser print dialog');
  expect(screen.queryByTestId('receipt-printer-mismatch')).toBeNull();
});

test('the mismatch note follows the selected thermal template and disappears for HTML', () => {
  const templates = [marked, thermal('thermal', 'Receipt')];
  const { rerender } = render(<ReceiptTemplateRow templates={templates} selectedId="thermal" onSelect={() => {}} />);
  expect(screen.getByTestId('receipt-printer-mismatch').textContent).toBe(
    'This thermal template will print its on-screen preview through the print dialog. To print it as designed, choose an HTML template.');
  rerender(<ReceiptTemplateRow templates={templates} selectedId="g12" onSelect={() => {}} />);
  expect(screen.queryByTestId('receipt-printer-mismatch')).toBeNull();
});

test('the Template row precedes the Printer row, which precedes the mismatch note', () => {
  render(<ReceiptTemplateRow templates={[marked, thermal('thermal', 'Receipt')]} selectedId="thermal" onSelect={() => {}} />);
  const template = screen.getByTestId('receipt-template-row');
  const printer = screen.getByTestId('receipt-printer-row');
  const mismatch = screen.getByTestId('receipt-printer-mismatch');
  expect(template.compareDocumentPosition(printer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(printer.compareDocumentPosition(mismatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('the Printer row keeps one line off a phone and stacks the key above the value on a phone', () => {
  const row = () => render(<ReceiptTemplateRow templates={[marked]} selectedId="g12" onSelect={() => {}} />);
  row();
  expect(classesOf('receipt-printer-row')).toEqual(expect.arrayContaining(['flex-row', 'items-center']));
  cleanup();
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  row();
  expect(classesOf('receipt-printer-row')).not.toContain('flex-row');
});

test('with one store template the receipt shows its title and no select', async () => {
  await sellEspresso(async () => [marked]);
  await screen.findByTestId('store-receipt-frame');
  expect(screen.getByTestId('receipt-template-title').textContent).toBe('g12');
  expect(screen.getByTestId('receipt-printer-value').textContent).toBe('Browser print dialog');
  expect(screen.queryByTestId('receipt-template-select')).toBeNull();
}, 20_000);

test('the printed area carries the chosen template, not the first', async () => {
  await sellEspresso(async () => [marked, second]);
  await screen.findByTestId('store-receipt-frame');
  fireEvent.click(screen.getByTestId('receipt-template-select'));
  fireEvent.click(screen.getByTestId('receipt-template-second'));
  const area = screen.getByTestId('receipt-print-area');
  await waitFor(() => expect(within(area).getByTestId('store-receipt-frame').getAttribute('srcdoc')).toContain('SECOND-MARKER'));
  expect(within(area).getByTestId('store-receipt-frame').getAttribute('srcdoc')).not.toContain('G12-MARKER');
  expect(within(area).queryByTestId('receipt-template-row')).toBeNull();
  expect(within(area).queryByTestId('receipt-printer-row')).toBeNull();
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByTestId('store-receipt-print'));
  expect(print).toHaveBeenCalledTimes(1);
}, 20_000);

test('ReceiptPrintSheet holds the auto print until it is ready, then prints once', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const orderId = `held-${crypto.randomUUID()}`;
  const { rerender } = render(<ReceiptPrintSheet orderId={orderId} autoPrint ready={false}><Text>Receipt</Text></ReceiptPrintSheet>);
  expect(print).not.toHaveBeenCalled();
  rerender(<ReceiptPrintSheet orderId={orderId} autoPrint ready><Text>Receipt</Text></ReceiptPrintSheet>);
  expect(print).toHaveBeenCalledTimes(1);
});

// v2 relabels its one print choice once printed and keeps it outline (receipt-stage.tsx:184-189, :308-310).
test("the store receipt's one print button reads Print again after a print, and the sheet adds none", async () => {
  await sellEspresso(async () => [marked]);
  await screen.findByTestId('store-receipt-frame');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print receipt');
  fireEvent.click(screen.getByTestId('store-receipt-print'));
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print again');
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.queryByTestId('receipt-print-again')).toBeNull();
  expect(screen.getAllByRole('button', { name: /Print/ })).toHaveLength(1);
}, 20_000);

// The sale screen counts the sheet's afterprint for the order and hands it to the store receipt as printed.
test("an auto print relabels the store receipt's button Print again without a press", async () => {
  saveReceiptSettings({ autoPrint: true, autoShow: true });
  const print = vi.spyOn(window, 'print').mockImplementation(() => { window.dispatchEvent(new Event('afterprint')); });
  await sellEspresso(async () => [marked]);
  const frame = await screen.findByTestId('store-receipt-frame');
  expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print receipt');
  fireEvent.load(frame);
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print again'));
}, 20_000);

const storeReceipt = (printed?: boolean) => render(
  <StoreReceipt html="<p>Receipt</p>" doneLabel="New sale" onDone={() => {}} onLoad={() => {}} printed={printed} />);

test('a failed store-receipt print keeps Print receipt and says why', () => {
  vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });
  storeReceipt();
  fireEvent.click(screen.getByTestId('store-receipt-print'));
  expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print receipt');
  expect(screen.getByTestId('store-receipt-error').textContent).toBe('The receipt did not print: blocked');
});

test('the store receipt reads Print again when the order has printed already', () => {
  storeReceipt(true);
  expect(screen.getByTestId('store-receipt-print').textContent).toBe('Print again');
});

test("the print sheet's Print again is an outline button", () => {
  render(<ReceiptPrintSheet orderId={`outline-${crypto.randomUUID()}`}><Text>Receipt</Text></ReceiptPrintSheet>);
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(classesOf('receipt-print-again')).toEqual(expect.arrayContaining(['border', 'bg-card']));
  expect(classesOf('receipt-print-again')).not.toContain('bg-primary');
});
