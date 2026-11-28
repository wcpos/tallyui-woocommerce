import { setLineQuantity } from './cart-line-helpers';
import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import * as CatalogueContext from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash, takeLeg } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

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

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test.each([
  { scenario: 'a scan adds a line during the two-pane checkout', code: '2000000000015', leg: false, before: '$3.00', after: '$6.00', quantity: '2' },
  // @tallyui/pos 4.0.0 f1c118f: a captured till payment refuses line changes (SALE_HAS_PAYMENT).
  { scenario: 'a scan adds nothing after one leg is taken', code: '2000000000015', leg: true, before: '$2.00', after: '$2.00', quantity: '1' },
  { scenario: 'an unknown code adds nothing during the two-pane checkout', code: '999999999', leg: false, before: '$3.00', after: '$3.00', quantity: '1' },
])('$scenario', async ({ code, leg, before, after, quantity }) => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={true} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(within(screen.getByTestId('pos-cart-panel')).getByTestId('checkout-ledger-pane')).not.toBeNull();
  if (leg) takeLeg(100);
  expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe(before);
  const recordedLegs = within(screen.getByTestId('checkout-ledger')).queryAllByTestId(/^checkout-leg-/)
    .map(row => ({ id: row.getAttribute('data-testid'), text: row.textContent }));
  if (leg) {
    expect(recordedLegs).toHaveLength(1);
    expect(recordedLegs[0].text).toContain('Cash');
    expect(recordedLegs[0].text).toContain('$1.00');
  }
  vi.useFakeTimers();
  try {
    act(() => {
      for (const key of [...code, 'Enter']) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        vi.advanceTimersByTime(5);
      }
    });
    expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe(after);
    expect(within(screen.getByTestId('checkout-ledger')).queryAllByTestId(/^checkout-leg-/)
      .map(row => ({ id: row.getAttribute('data-testid'), text: row.textContent }))).toEqual(recordedLegs);
    expect(screen.getByTestId('checkout-ledger-paid').textContent).toBe(leg ? '$1.00' : '$0.00');
    expect(screen.queryByTestId('variation-picker')).toBeNull();
    expect(screen.queryByText('Choose an option')).toBeNull();
    if (!leg) {
      // This tree has no Toaster; return to the cart to verify the scanned quantity.
      fireEvent.click(screen.getByTestId('checkout-close'));
      expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe(quantity);
      expect(screen.queryByTestId('variation-picker')).toBeNull();
      expect(screen.queryByText('Choose an option')).toBeNull();
    }
  } finally {
    cleanup();
    vi.useRealTimers();
  }
}, 20_000);

test('cash quick amounts start at the remaining balance after a payment leg', async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={true} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$4.00');
  expect(screen.getByTestId('checkout-quick-4').textContent).toBe('$4.00');
  expect(screen.getAllByTestId(/^checkout-quick-\d/).map(chip => chip.textContent)).toEqual(['$4.00', '$5.00', '$10.00', '$50.00']);
  expect(screen.getByTestId('checkout-quick-exact').textContent).toBe('Exact $4.00');
}, 20_000);

test.each([true, false, undefined])('uses the advertised tender UI with multiplePayments=%s', async multiplePayments => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  if (multiplePayments === true) {
    expect(screen.getByTestId('checkout-ledger')).not.toBeNull();
    takeLeg(200);
    expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$4.00');
    takeLeg(400, 'pos_card');
  } else {
    expect(screen.getByTestId('checkout-keypad')).not.toBeNull();
    expect(within(screen.getByTestId('pos-products-panel')).queryByTestId('checkout-ledger')).toBeNull();
    await takeCash(600);
  }
  const receipt = within((await screen.findByTestId('receipt-order')).parentElement!);
  expect(receipt.getByLabelText('Total: $6.00')).not.toBeNull();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  const { payments, totalMinor } = envelopes[0].payload;
  expect(payments).toEqual(multiplePayments === true
    ? [expect.objectContaining({ method: 'cash', amountMinor: 200 }), expect.objectContaining({ method: 'external', amountMinor: 400 })]
    : [expect.objectContaining({ method: 'cash', amountMinor: 600 })]);
  expect(payments.reduce((sum, payment) => sum + payment.amountMinor, 0)).toBe(totalMinor);
}, 20_000);

test('the existing outbox transport sees a catalogue capability that arrives later', async () => {
  const catalogue = vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({ catalogue: null, products: [], status: 'starting' });
  // connector 5.6.1 reads /site (stock WCPOS 1.10.20) and /status, which must advertise order_payments_list for a split.
  const fetchStub = vi.fn<typeof fetch>(async input => String(input).endsWith('/site') ? Response.json({ wcpos_version: '1.10.20' })
    : String(input).endsWith('/status') ? Response.json({ capabilities: ['order_payments_list'] }) : Response.json({
    document: { id: 115, status: 'completed', total: '6.000000' }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  const posts = () => fetchStub.mock.calls.filter(([, init]) => init?.method === 'POST');
  const storage = getRxStorageMemory();
  const connector = createWooCommerceConnector();
  const view = (multiplePayments?: boolean) => (
    <SessionProvider>
      <OutboxProvider storage={storage}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={connector} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>
  );
  const { rerender } = render(view());
  await screen.findByText('Order store ready');
  catalogue.mockReturnValue({ catalogue: { capabilities: { orderCreate: 3, multiplePayments: true } } as Catalogue,
    products, status: 'ready' });
  rerender(view(true));
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(posts()).toHaveLength(1);
  const { payload } = JSON.parse(posts()[0][1]!.body as string);
  expect(payload.payment_method).toBe('pos_card');
  expect(JSON.parse(payload.meta_data.find((entry: { key: string }) => entry.key === '_woocommerce_pos_payments').value)).toHaveLength(2);
}, 20_000);

test.each([
  { scenario: 'Split 3 ways prefills each share', kind: 'three' },
  { scenario: 'the plan starts after a leg already taken', kind: 'prior' },
  { scenario: 'Change split and Split off restore the balance', kind: 'change' },
  { scenario: 'the one-payment pane has no Split chip', kind: 'single' },
  { scenario: 'a voided leg is not counted by a split started after it', kind: 'voided' },
])('$scenario', async ({ kind }) => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={kind !== 'single'} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  if (kind === 'single') {
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$6.00');
    expect(screen.queryByTestId('checkout-split-chip')).toBeNull();
    return;
  }
  if (kind === 'prior') takeLeg(100);
  if (kind === 'voided') {
    takeLeg(100);
    fireEvent.click(screen.getByTestId(/^checkout-remove-leg-/));
    await waitFor(() => expect(screen.getByTestId(/^checkout-status-leg-/).textContent).toBe('Voided'));
  }
  fireEvent.click(screen.getByTestId('checkout-split-chip'));
  expect(screen.getByText('Split the rest')).not.toBeNull();
  expect(screen.getByTestId('checkout-split-chip').getAttribute('aria-pressed')).toBe('true');
  if (kind === 'prior') {
    expect(within(screen.getByTestId('checkout-even-2')).getByText('$2.50 each')).not.toBeNull();
    fireEvent.click(screen.getByTestId('checkout-even-2'));
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.50');
    expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 1 of 2 · $5.00 left');
    expect(screen.getByTestId('checkout-plan-done').textContent).toBe('Cash $1.00');
    return;
  }
  if (kind === 'voided') {
    expect(within(screen.getByTestId('checkout-even-2')).getByText('$3.00 each')).not.toBeNull();
    fireEvent.click(screen.getByTestId('checkout-even-2'));
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$3.00');
    expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 1 of 2 · $6.00 left');
    fireEvent.click(screen.getByTestId('checkout-commit'));
    expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 2 of 2 · $3.00 left');
    return;
  }
  if (kind === 'change') {
    fireEvent.click(screen.getByTestId('checkout-even-2'));
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$3.00');
    fireEvent.click(screen.getByTestId('checkout-plan-change'));
    expect(screen.getByText('Split the rest')).not.toBeNull();
    expect(screen.getByTestId('checkout-even-3')).not.toBeNull();
    expect(screen.queryByTestId('checkout-plan')).toBeNull();
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$6.00');
    fireEvent.click(screen.getByTestId('checkout-even-3'));
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.00');
    fireEvent.click(screen.getByTestId('checkout-split-chip'));
    expect(screen.queryByText('Split the rest')).toBeNull();
    expect(screen.queryAllByTestId(/^checkout-even-/)).toHaveLength(0);
    expect(screen.queryByTestId('checkout-plan')).toBeNull();
    expect(screen.getByTestId('checkout-entry').textContent).toBe('$6.00');
    expect(screen.getByTestId('checkout-label').textContent).toBe('To pay');
    expect(screen.getByTestId('checkout-split-chip').getAttribute('aria-pressed')).toBe('false');
    return;
  }
  const tile = within(screen.getByTestId('checkout-even-3'));
  expect(within(screen.getByTestId('checkout-split-ways')).getByTestId('checkout-even-6')).not.toBeNull();
  expect(tile.getByText('3 ways')).not.toBeNull();
  expect(tile.getByText('$2.00 each')).not.toBeNull();
  fireEvent.click(screen.getByTestId('checkout-even-3'));
  expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.00');
  expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 1 of 3 · $6.00 left');
  expect(screen.getByTestId('checkout-commit').textContent).toBe('Take $2.00 in Cash · 1 of 3');
  expect(screen.getByTestId('checkout-plan-leg-0').textContent).toBe('$2.00');
  expect(screen.getByTestId('checkout-plan-leg-1').textContent).toBe('Then 2 × $2.00');
  expect(screen.queryByTestId('checkout-plan-leg-2')).toBeNull();
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 2 of 3 · $4.00 left');
  expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.00');
  expect(screen.getByTestId('checkout-plan-done').textContent).toBe('Cash $2.00');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.00');
  expect(screen.getByTestId('checkout-commit').textContent).toBe('Take $2.00 in Card · 2 of 3');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(screen.getByTestId('checkout-label').textContent).toBe('Payment 3 of 3 · $2.00 left');
  expect(screen.getByTestId('checkout-entry').textContent).toBe('$2.00');
  expect(screen.getByTestId('checkout-plan-done').textContent).toBe('2 paid · $4.00');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  const receipt = within((await screen.findByTestId('receipt-order')).parentElement!);
  expect(receipt.getByLabelText('Total: $6.00')).not.toBeNull();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  expect(envelopes[0].payload.payments).toEqual([
    expect.objectContaining({ method: 'cash', amountMinor: 200 }),
    expect.objectContaining({ method: 'external', amountMinor: 200 }),
    expect.objectContaining({ method: 'external', amountMinor: 200 }),
  ]);
}, 20_000);

// WCPOS v2: tender-figures.ts:134,147, tender-pane.tsx:285-334, core.json pos_checkout.less_than_planned(_n, _next_n).
test.each([
  { scenario: 'a 2-way split below the planned share moves the rest to the next payment', ways: 2, entry: 100, hint: 'Less than planned · $2.00 moves to the next payment' },
  { scenario: 'a 3-way split below the planned share names payments 2 and 3', ways: 3, entry: 100, hint: 'Less than planned · $1.00 moves to payments 2 and 3' },
  { scenario: 'a 4-way split below the planned share counts the next 3 payments', ways: 4, entry: 100, hint: 'Less than planned · $0.50 moves to the next 3 payments' },
  { scenario: 'a split entry at exactly the planned share has no hint', ways: 2, entry: 300, hint: '' },
  { scenario: 'with no plan an entry below the balance is still a part payment', ways: 0, entry: 100, hint: 'Part payment · $5.00 left after this' },
])('$scenario', async ({ ways, entry, hint }) => {
  const fakeTransport = { send: vi.fn<CommandTransport<OrderCreateEnvelope>['send']>() };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={true} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  if (ways > 0) {
    fireEvent.click(screen.getByTestId('checkout-split-chip'));
    fireEvent.click(screen.getByTestId(`checkout-even-${ways}`));
    expect(screen.getByTestId('checkout-label').textContent).toBe(`Payment 1 of ${ways} · $6.00 left`);
  }
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of String(entry)) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  expect(screen.getByTestId('checkout-entry-hint').textContent).toBe(hint);
  expect(fakeTransport.send).not.toHaveBeenCalled();
}, 20_000);

// v2 tender-pane.tsx:377: the tender column scrolls, so a tall phone checkout reaches Back and the commit button.
test.each([
  { scenario: 'the phone tender and its ledger scroll in checkout-scroll', width: 390, multiplePayments: true, checkout: true },
  { scenario: 'the one-payment tender scrolls in checkout-scroll', width: 900, multiplePayments: false, checkout: true },
  { scenario: 'the cart stage has no checkout-scroll', width: 390, multiplePayments: true, checkout: false },
])('$scenario', async ({ width, multiplePayments, checkout }) => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send: vi.fn() })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  if (!checkout) {
    expect(screen.getByTestId('cart-checkout')).not.toBeNull();
    expect(screen.queryByTestId('checkout-scroll')).toBeNull();
    return;
  }
  fireEvent.click(screen.getByTestId('cart-checkout'));
  const scroll = within(screen.getByTestId('checkout-scroll'));
  expect(scroll.getByTestId('checkout-tender')).not.toBeNull();
  if (multiplePayments) expect(scroll.getByTestId('checkout-ledger-pane')).not.toBeNull();
}, 20_000);
