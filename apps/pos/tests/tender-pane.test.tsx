import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { useElapsed } from '../components/tender-pane';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { OnlineStatusContext, type OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { takeLeg } from './tender-helpers';

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
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

let orders: (ReturnType<typeof useOutbox> & { enabled: true })['orders'];

function OrderStoreReady() {
  const outbox = useOutbox();
  if (!outbox.enabled || !outbox.orders) return null;
  orders = outbox.orders;
  return <span>Order store ready</span>;
}

/** One Espresso ($3.00, or `price`) in the cart of a store that takes one payment per order, then the cart's `button`. */
async function startTender(button: 'Cash' | 'Card terminal', status: OnlineStatus = 'online-website-available', multi = false, price?: string) {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const fakeTransport = { send };
  render(
    <OnlineStatusContext.Provider value={{ status }}>
      <SessionProvider>
        <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
            products={price ? products.map(p => p.name === 'Espresso' ? { ...p, price, regular_price: price } : p) : products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            multiplePayments={multi} />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </OnlineStatusContext.Provider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  // v2's foot: Checkout opens the tender on Cash; Card is picked on the tender pane's tiles.
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
  if (button === 'Card terminal') fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  return send;
}

const press = (...keys: string[]) => { for (const key of keys) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${key}`)); };
const text = (testId: string) => screen.getByTestId(testId).textContent;
const disabled = () => screen.getByTestId('checkout-commit').getAttribute('aria-disabled');

// react-native-web drops className from the DOM, so read it off the component that took the testID (as coupons-screen.test).
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber; alternate?: Fiber };
function classesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(node).find(name => name.startsWith(prefix))!;
  const created = node[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === node[key('__reactProps$')] ? created : created.alternate;
  const found: string[] = [];
  for (; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

async function sentPayments(send: Awaited<ReturnType<typeof startTender>>) {
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  return envelopes[0].payload.payments;
}

test('cash: a keypad entry above the total shows the change and takes the total in cash', async () => {
  const send = await startTender('Cash');
  expect(screen.getByTestId('checkout-method-pos_cash').getAttribute('aria-selected')).toBe('true');
  expect(text('checkout-entry')).toBe('$3.00');
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
  press('clear', '1', '0', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $10.00');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 })]);
}, 20_000);

test('keypad clear and backspace edit the entry in minor units and an entry under the total cannot be taken', async () => {
  await startTender('Cash');
  press('clear');
  expect(text('checkout-entry')).toBe('$0.00');
  expect(disabled()).toBe('true');
  press('2', '5');
  expect(text('checkout-entry')).toBe('$0.25');
  press('backspace');
  expect(text('checkout-entry')).toBe('$0.02');
  expect(text('checkout-entry-hint')).toBe('Part payment · $2.98 left after this');
  expect(disabled()).toBe('true');
}, 20_000);

test('card refuses an over-tender and takes the total with the terminal reference', async () => {
  const send = await startTender('Card terminal');
  expect(screen.getByTestId('checkout-method-pos_card').getAttribute('aria-selected')).toBe('true');
  press('clear', '4', '0', '0');
  expect(text('checkout-entry-hint')).toBe("Only $3.00 is due — Card can't give change");
  expect(disabled()).toBe('true');
  press('clear', '3', '0', '0');
  expect(text('checkout-commit')).toBe('Take $3.00 in Card');
  expect(disabled()).not.toBe('true');
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-9' } });
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'external', amountMinor: 300, reference: 'T-9' })]);
}, 20_000);

test('switching tiles changes the method the commit takes', async () => {
  await startTender('Cash');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  expect(text('checkout-commit')).toBe('Take $3.00 in Card');
  expect(screen.getByLabelText('Terminal reference')).not.toBeNull();
  fireEvent.click(screen.getByTestId('checkout-method-pos_cash'));
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
  expect(screen.queryByLabelText('Terminal reference')).toBeNull();
}, 20_000);

test('switching tiles then taking sends one payment in the chosen method', async () => {
  const send = await startTender('Cash');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-1' } });
  fireEvent.click(screen.getByTestId('checkout-commit'));
  const payments = await sentPayments(send);
  expect(payments).toEqual([expect.objectContaining({ method: 'external', amountMinor: 300, reference: 'T-1' })]);
  expect(payments.some(payment => payment.method === 'cash')).toBe(false);
}, 20_000);

test('switching from card to cash then taking sends the cash tendered and its change', async () => {
  const send = await startTender('Card terminal');
  fireEvent.click(screen.getByTestId('checkout-method-pos_cash'));
  press('clear', '5', '0', '0');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 500, changeMinor: 200 })]);
}, 20_000);

test('cash shows quick amounts in order and takes the selected tender with change', async () => {
  const send = await startTender('Cash');
  expect(within(screen.getByTestId('checkout-helpers')).getAllByRole('button').map(chip => [chip.dataset.testid, chip.textContent])).toEqual([
    ['checkout-quick-3', '$3.00'],
    ['checkout-quick-5', '$5.00'],
    ['checkout-quick-10', '$10.00'],
    ['checkout-quick-50', '$50.00'],
    ['checkout-quick-exact', 'Exact $3.00'],
  ]);
  fireEvent.click(screen.getByTestId('checkout-quick-10'));
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $10.00');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 })]);
}, 20_000);

test('Exact restores the amount due after a keypad edit', async () => {
  await startTender('Cash');
  press('clear', '1');
  expect(text('checkout-entry')).toBe('$0.01');
  fireEvent.click(screen.getByTestId('checkout-quick-exact'));
  expect(text('checkout-entry')).toBe('$3.00');
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
}, 20_000);

/** The `ids` present under the tender pane, in document order (the DOM react-native-web renders). */
function order(ids: string[]) {
  return Array.from(screen.getByTestId('checkout-tender').querySelectorAll<HTMLElement>('[data-testid]'))
    .map(node => node.dataset.testid!).filter(id => ids.includes(id));
}

test('the tender pane reads To pay, the figure, its hint, then the method tiles, then the quick amounts (v2 :395-483)', async () => {
  await startTender('Cash');
  const ids = ['checkout-label', 'checkout-entry', 'checkout-entry-hint', 'checkout-method-pos_cash', 'checkout-method-pos_card', 'checkout-helpers'];
  expect(order(ids)).toEqual(ids);
}, 20_000);

test('once change is due, Change and the Tendered line still come before the method tiles', async () => {
  await startTender('Cash');
  press('clear', '1', '0', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  const ids = ['checkout-label', 'checkout-entry-hint', 'checkout-tendered-line', 'checkout-method-pos_cash', 'checkout-method-pos_card', 'checkout-helpers'];
  expect(order(ids)).toEqual(ids);
}, 20_000);

test('card has no quick amounts and Full balance restores the amount due', async () => {
  await startTender('Card terminal');
  expect(screen.queryAllByTestId(/^checkout-quick-\d/)).toHaveLength(0);
  expect(screen.queryByTestId('checkout-quick-exact')).toBeNull();
  expect(text('checkout-quick-balance')).toBe('Full balance');
  press('clear', '1');
  expect(text('checkout-entry')).toBe('$0.01');
  expect(text('checkout-quick-balance')).toBe('Full balance $3.00');
  fireEvent.click(screen.getByTestId('checkout-quick-balance'));
  expect(text('checkout-entry')).toBe('$3.00');
}, 20_000);

test('cash quick amounts follow the applied entry', async () => {
  await startTender('Cash');
  press('clear', '2', '0', '0');
  expect(text('checkout-entry')).toBe('$2.00');
  expect(screen.getAllByTestId(/^checkout-quick-\d/).map(chip => chip.textContent)).toEqual(['$2.00', '$5.00', '$10.00', '$50.00']);
}, 20_000);

test('offline, both tiles say the payment is sent later and the store may refuse', async () => {
  await startTender('Cash', 'offline');
  expect(screen.getByTestId('checkout-method-sent-later-pos_cash').textContent).toBe('Sent laterStore may refuse');
  expect(screen.getByTestId('checkout-method-sent-later-pos_card').textContent).toBe('Sent laterStore may refuse');
  expect(disabled()).not.toBe('true');
}, 20_000);

test('a store that cannot be reached counts as offline for the tiles', async () => {
  await startTender('Card terminal', 'online-website-unavailable');
  expect(screen.getByTestId('checkout-method-sent-later-pos_card')).not.toBeNull();
}, 20_000);

test('online, the tiles carry no sent-later line', async () => {
  await startTender('Cash');
  expect(screen.queryByTestId('checkout-method-sent-later-pos_cash')).toBeNull();
  expect(screen.queryByTestId('checkout-method-sent-later-pos_card')).toBeNull();
  expect(screen.queryByTestId('checkout-offline')).toBeNull();
}, 20_000);

// WCPOS v2: tender-pane.tsx:280, :1030 (methodIcon), tabler register.svg and card.svg.
const glyphPaths = (glyph: HTMLElement) => Array.from(glyph.querySelectorAll('path')).map(path => path.getAttribute('d')?.slice(0, 14));

test('the Cash tile draws v2\'s register glyph and the Card tile its card glyph', async () => {
  await startTender('Cash');
  const cash = within(screen.getByTestId('checkout-method-pos_cash'));
  const card = within(screen.getByTestId('checkout-method-pos_card'));
  expect(glyphPaths(cash.getByTestId('checkout-method-icon-pos_cash-register'))).toEqual(['M21 15h-2.5a1.', 'M16 10V4a2 2 0']);
  expect(glyphPaths(card.getByTestId('checkout-method-icon-pos_card-card'))).toEqual(['M3 8a3 3 0 0 1']);
  expect(cash.queryByTestId('checkout-method-icon-pos_cash-card')).toBeNull();
  expect(card.queryByTestId('checkout-method-icon-pos_card-register')).toBeNull();
}, 20_000);

test('each method glyph comes before its title inside the tile', async () => {
  await startTender('Cash');
  for (const [id, glyph, title] of [['pos_cash', 'register', 'Cash'], ['pos_card', 'card', 'Card']] as const) {
    const tile = within(screen.getByTestId(`checkout-method-${id}`));
    const icon = tile.getByTestId(`checkout-method-icon-${id}-${glyph}`);
    expect(icon.compareDocumentPosition(tile.getByText(title)) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  }
}, 20_000);

// WCPOS v2: tender-pane.tsx:284-299, core.json pos_checkout.part_payment_left.
test('a cash entry below the total is a part payment with what is left after it', async () => {
  await startTender('Cash');
  press('clear', '1', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Part payment · $2.00 left after this');
}, 20_000);

// WCPOS v2: tender-pane.tsx:437-440, AmountFigure tone="ok".
test('change due reads in the success ink', async () => {
  await startTender('Cash');
  press('clear', '1', '0', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  expect(classesOf('checkout-entry-hint')).toContain('text-success');
  expect(classesOf('checkout-entry-hint')).not.toContain('text-foreground');
}, 20_000);

// WCPOS v2: tender-pane.tsx:441-449.
test('multi: after one leg the Tendered line adds the order total; the first leg has none', async () => {
  await startTender('Cash', 'online-website-available', true);
  press('clear', '5', '0', '0');
  expect(text('checkout-tendered-line')).toBe('Tendered $5.00');
  takeLeg(100);
  await waitFor(() => expect(text('checkout-label')).toBe('Payment 2 · $2.00 left'));
  press('clear', '5', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $3.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $5.00 · Total $3.00');
}, 20_000);

// WCPOS v2: tender-pane.tsx:430-434, core.json pos_checkout.offline.
test('offline, the To pay row ends with an Offline caption', async () => {
  await startTender('Cash', 'offline');
  expect(text('checkout-offline')).toBe('Offline');
  expect(classesOf('checkout-offline')).toEqual(expect.arrayContaining(['text-xs', 'text-warning']));
}, 20_000);

/** Holds the next order save until the returned release is called, so a test reads the pane while it saves. */
function holdSave(): () => void {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const insert = orders!.insert.bind(orders!);
  vi.spyOn(orders!, 'insert').mockImplementationOnce(async doc => { await gate; return insert(doc); });
  return release;
}

// WCPOS v2: tender-pane.tsx:117-118 (the keypad stays drawn while the order saves) and tender-figures.ts:165.
test("multi: paid in full by a card leg then a cash leg, the header reads the order's change while it saves", async () => {
  await startTender('Cash', 'online-website-available', true);
  const release = holdSave();
  takeLeg(100, 'pos_card');
  await waitFor(() => expect(text('checkout-label')).toBe('Payment 2 · $2.00 left'));
  takeLeg(500);
  await waitFor(() => expect(text('checkout-commit')).toBe('Saving order…'));
  expect(text('checkout-entry-hint')).toBe('Change $3.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $5.00 · Total $3.00');
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}, 20_000);

test('multi: with a leg still to come, the entry reads its change against the balance', async () => {
  await startTender('Cash', 'online-website-available', true);
  takeLeg(100, 'pos_card');
  await waitFor(() => expect(text('checkout-label')).toBe('Payment 2 · $2.00 left'));
  fireEvent.click(screen.getByTestId('checkout-method-pos_cash'));
  press('clear', '5', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $3.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $5.00 · Total $3.00');
}, 20_000);

test('multi: paid in full by card legs alone shows no Change while it saves', async () => {
  await startTender('Cash', 'online-website-available', true);
  const release = holdSave();
  takeLeg(100, 'pos_card');
  await waitFor(() => expect(text('checkout-label')).toBe('Payment 2 · $2.00 left'));
  takeLeg(200, 'pos_card');
  await waitFor(() => expect(text('checkout-commit')).toBe('Saving order…'));
  expect(screen.queryByText(/^Change /)).toBeNull();
  expect(screen.queryByTestId('checkout-tendered-line')).toBeNull();
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}, 20_000);

test('multi: on a free order with no payment yet, a cash entry still reads as change', async () => {
  await startTender('Cash', 'online-website-available', true, '0.00');
  press('clear', '5', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $5.00');
}, 20_000);

// WCPOS v2: tender-pane.tsx:46-58, 106, 587-591; core.json pos_checkout.store_not_answering.
const SLOW = "The store isn't answering. Keep waiting.";
/** Only setTimeout is faked, from before the press, so the pane's slow-save timer is the one these tests move. */
const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

test("a save held past 4 s says the store isn't answering, and the line goes with the save", async () => {
  await startTender('Cash');
  const release = holdSave();
  fakeTimers();
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(text('checkout-commit')).toBe('Saving order…');
  advance(3_900);
  expect(screen.queryByTestId('checkout-save-slow')).toBeNull();
  advance(100);
  expect(text('checkout-save-slow')).toBe(SLOW);
  expect(classesOf('checkout-save-slow')).toEqual(expect.arrayContaining(['text-center', 'text-sm', 'text-warning']));
  vi.useRealTimers();
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(screen.queryByTestId('checkout-save-slow')).toBeNull();
}, 20_000);

test("multi: the paying leg's save says the store isn't answering after 4 s", async () => {
  await startTender('Cash', 'online-website-available', true);
  const release = holdSave();
  fakeTimers();
  takeLeg(300);
  expect(text('checkout-commit')).toBe('Saving order…');
  advance(3_900);
  expect(screen.queryByTestId('checkout-save-slow')).toBeNull();
  advance(100);
  expect(text('checkout-save-slow')).toBe(SLOW);
  vi.useRealTimers();
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(screen.queryByTestId('checkout-save-slow')).toBeNull();
}, 20_000);

// The failing insert is ledger-pane.test's pattern; this file had none of its own.
test("a failed save does not say the store isn't answering", async () => {
  await startTender('Cash');
  vi.spyOn(orders!, 'insert').mockRejectedValueOnce(new Error('disk full'));
  // The failed save waits on a timer of its own before the error lands, so fake time also follows the clock here.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  fireEvent.click(screen.getByTestId('checkout-commit'));
  await screen.findByText('The sale could not be saved: disk full');
  advance(4_000);
  expect(screen.queryByTestId('checkout-save-slow')).toBeNull();
}, 20_000);

// In the pane a failed save keeps its error until success, which unmounts it, so the reset is read at the hook.
test('useElapsed resets when active changes, so a second save waits the full delay again', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ active }) => useElapsed(active, 4_000), { initialProps: { active: true } });
  advance(4_000);
  expect(result.current).toBe(true);
  rerender({ active: false });
  expect(result.current).toBe(false);
  rerender({ active: true });
  expect(result.current).toBe(false);
  advance(3_900);
  expect(result.current).toBe(false);
  advance(100);
  expect(result.current).toBe(true);
});
