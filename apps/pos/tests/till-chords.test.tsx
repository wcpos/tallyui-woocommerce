import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { stripCartIds } from '../components/open-order-tabs';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { noTaxSettings } from './fixtures/store-settings';
import { memoryStorage } from './memory-storage';

// WCPOS v2's till chords (hotkeys/bindings.ts:9-16, hotkeys.web.tsx:12-29, commands/commands.ts:12-37,
// commands/provider.tsx:57-75, pos/cart/add-cart-items-menu.tsx:41). By desk ruling (19 Nov 2026) they never fire
// while a text field has focus; Alt+F still does.

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

const till = (extra: Partial<SaleScreenProps> = {}) => render(<><SaleScreen {...props} {...extra} /><PortalHost /></>);

const KEYS = { n: { key: '˜', code: 'KeyN' }, d: { key: '∂', code: 'KeyD' }, p: { key: 'π', code: 'KeyP' },
  f: { key: 'ƒ', code: 'KeyF' }, left: { key: 'ArrowLeft', code: 'ArrowLeft' }, right: { key: 'ArrowRight', code: 'ArrowRight' } };
type Chord = keyof typeof KEYS;

/** Presses Alt+key on `target` (the document by default) and lets a park or resume settle; returns defaultPrevented. */
async function press(chord: Chord, target: Element | Document = document): Promise<boolean> {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, altKey: true, ...KEYS[chord] });
  await act(async () => { target.dispatchEvent(event); });
  return event.defaultPrevented;
}

const add = (name: string) => fireEvent.click(screen.getByText(name));
const line = (name: string) => screen.queryByLabelText(`Edit quantity of ${name}`);
const strip = () => within(screen.getByTestId('open-order-strip'));
/** The strip's tabs, + excluded, in order: whether each is the selected (current) cart. */
const tabs = () => strip().queryAllByRole('tab').filter(tab => tab.getAttribute('data-testid') !== 'new-order-tab')
  .map(tab => tab.getAttribute('aria-selected') === 'true');
const blank = () => screen.getByTestId('new-order-tab').getAttribute('aria-selected') === 'true';
// The open cart by its lines: Espresso, Cold Brew, or both (the fixture sells two simple products).
const openLine = () => ['Espresso', 'Cold Brew'].filter(name => line(name) !== null).join(' + ');

/** Parks Espresso, then Cold Brew, and opens both: three carts, the current one last. */
async function threeCarts() {
  till();
  add('Espresso');
  await press('n');
  add('Cold Brew');
  await press('n');
  add('Espresso');
  add('Cold Brew');
  expect(tabs()).toEqual([false, false, true]);
}

test('stripCartIds is the strip order: oldest first, the current cart at its place, left out when blank', () => {
  const parked = [{ id: 'b', parkedAt: '2026-11-19T10:02:00Z' }, { id: 'a', parkedAt: '2026-11-19T10:01:00Z' }];
  expect(stripCartIds(parked, { id: 'c', lineItems: [{}] }, undefined)).toEqual(['a', 'b', 'c']);
  expect(stripCartIds(parked, { id: 'c', lineItems: [{}] }, '2026-11-19T10:01:30Z')).toEqual(['a', 'c', 'b']);
  expect(stripCartIds(parked, { id: 'c', lineItems: [] }, undefined)).toEqual(['a', 'b']);
});

test('alt+n parks a cart with lines and starts a blank one; on a blank cart it does nothing', async () => {
  till();
  expect(await press('n')).toBe(false);
  expect(tabs()).toEqual([]);
  add('Espresso');
  expect(await press('n')).toBe(true);
  expect(tabs()).toEqual([false]);
  expect(blank()).toBe(true);
  expect(line('Espresso')).toBeNull();
  expect(await press('n')).toBe(false);
  expect(tabs()).toEqual([false]);
}, 20_000);

test('two fast alt+n presses park once', async () => {
  till();
  add('Espresso');
  const first = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, altKey: true, ...KEYS.n });
  const second = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, altKey: true, ...KEYS.n });
  await act(async () => { document.dispatchEvent(first); document.dispatchEvent(second); });
  expect(tabs()).toEqual([false]);
  // The second press was dropped, so it is no chord of its own: nothing parked a second cart once it settled.
  add('Cold Brew');
  await press('n');
  expect(tabs()).toEqual([false, false]);
}, 20_000);

test("alt+arrows walk the strip's order and wrap at both ends", async () => {
  await threeCarts();
  await press('right');
  await waitFor(() => expect(openLine()).toBe('Espresso'));
  expect(tabs()).toEqual([true, false, false]);
  await press('left');
  await waitFor(() => expect(openLine()).toBe('Espresso + Cold Brew'));
  expect(tabs()).toEqual([false, false, true]);
  await press('left');
  await waitFor(() => expect(openLine()).toBe('Cold Brew'));
  expect(tabs()).toEqual([false, true, false]);
  await press('left');
  await waitFor(() => expect(openLine()).toBe('Espresso'));
  await press('left');
  await waitFor(() => expect(openLine()).toBe('Espresso + Cold Brew'));
}, 30_000);

test('from the blank cart alt+right opens the oldest and alt+left the newest', async () => {
  till();
  add('Espresso');
  await press('n');
  add('Cold Brew');
  await press('n');
  expect(blank()).toBe(true);
  expect(await press('right')).toBe(true);
  await waitFor(() => expect(openLine()).toBe('Espresso'));
  // Parked again, Espresso keeps its first place, so the newest is still Cold Brew.
  await press('n');
  expect(blank()).toBe(true);
  expect(await press('left')).toBe(true);
  await waitFor(() => expect(openLine()).toBe('Cold Brew'));
}, 30_000);

test('with a single cart the arrows do nothing', async () => {
  till();
  add('Espresso');
  expect(await press('right')).toBe(false);
  expect(await press('left')).toBe(false);
  expect(openLine()).toBe('Espresso');
  await press('n');
  expect(await press('right')).toBe(false);
  expect(blank()).toBe(true);
}, 20_000);

test('alt+d opens Add Discount on the quick side; a second alt+d while it is open does nothing', async () => {
  till();
  add('Espresso');
  expect(await press('d')).toBe(true);
  const dialog = within(screen.getByTestId('add-discount-dialog'));
  // No coupons offered in this fixture, so the dialog is the quick discount form alone.
  expect(dialog.queryByTestId('add-discount-kind')).toBeNull();
  expect(dialog.getByRole('group', { name: 'Order discount' })).not.toBeNull();
  expect(await press('d')).toBe(false);
  expect(screen.getAllByTestId('add-discount-dialog')).toHaveLength(1);
}, 20_000);

test('alt+d on a blank cart does nothing', async () => {
  till();
  expect(await press('d')).toBe(false);
  expect(screen.queryByTestId('add-discount-dialog')).toBeNull();
});

test('alt+p opens the tender as Checkout does; on a blank cart it does nothing', async () => {
  till();
  expect(await press('p')).toBe(false);
  add('Espresso');
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  expect(await press('p')).toBe(true);
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.getByText('Taking payment arrives in the next update')).not.toBeNull();
}, 20_000);

// RNW's TextInput stops every keydown it sees (react-native-web TextInput handleKeyDown, "Prevent key events
// bubbling"), so a key typed in the catalogue search never reaches the document. The plain input stands for any field
// that lets its keys bubble: the chords' own field guard is what leaves it alone.
test.each([['the search field', 'catalogue-search'], ['a plain input', 'plain-input']])(
  'in %s alt+n, alt+right, alt+d and alt+p do nothing and are not prevented', async (_, testID) => {
    render(<><SaleScreen {...props} /><input data-testid="plain-input" /><PortalHost /></>);
    add('Espresso');
    await press('n');
    add('Cold Brew');
    const field = screen.getByTestId(testID);
    field.focus();
    expect(document.activeElement).toBe(field);
    for (const chord of ['n', 'right', 'd', 'p'] as const) expect(await press(chord, field)).toBe(false);
    expect(openLine()).toBe('Cold Brew');
    expect(tabs()).toEqual([false, true]);
    expect(screen.queryByTestId('add-discount-dialog')).toBeNull();
    expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  }, 20_000);

test('alt+f still works from a field the cart chords leave alone', async () => {
  render(<><SaleScreen {...props} /><input data-testid="plain-input" /><PortalHost /></>);
  add('Espresso');
  const field = screen.getByTestId('plain-input');
  field.focus();
  expect(await press('n', field)).toBe(false);
  expect(await press('f', field)).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('catalogue-search')));
}, 20_000);

/** Presses every cart chord and checks that none fired: no park, no step, no dialog, no tender. */
async function noneFire() {
  for (const chord of ['n', 'right', 'left', 'd', 'p'] as const) expect(await press(chord)).toBe(false);
}

test('at checkout none fire', async () => {
  till();
  add('Espresso');
  await press('n');
  add('Cold Brew');
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  await noneFire();
  expect(screen.queryByTestId('add-discount-dialog')).toBeNull();
  fireEvent.click(screen.getByText('Back to cart'));
  expect(openLine()).toBe('Cold Brew');
  expect(tabs()).toEqual([false, true]);
}, 20_000);

test('with searchChord false none fire', async () => {
  till({ searchChord: false });
  add('Espresso');
  expect(await press('n')).toBe(false);
  // Not parked: the current cart is the strip's one tab.
  expect(tabs()).toEqual([true]);
  add('Cold Brew');
  fireEvent.click(screen.getByTestId('new-order-tab'));
  await waitFor(() => expect(tabs()).toEqual([false]));
  add('Espresso');
  add('Cold Brew');
  await noneFire();
  expect(openLine()).toBe('Espresso + Cold Brew');
  expect(tabs()).toEqual([false, true]);
  expect(screen.queryByTestId('add-discount-dialog')).toBeNull();
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
}, 20_000);

test('with a dialog open none fire', async () => {
  till();
  add('Espresso');
  await press('n');
  add('Cold Brew');
  const other = document.createElement('div');
  other.setAttribute('role', 'dialog');
  document.body.appendChild(other);
  try {
    await noneFire();
  } finally {
    other.remove();
  }
  expect(openLine()).toBe('Cold Brew');
  expect(tabs()).toEqual([false, true]);
  expect(screen.queryByTestId('add-discount-dialog')).toBeNull();
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
}, 20_000);

test('a document listener added after the hooks still sees the chord', async () => {
  till();
  add('Espresso');
  const seen: string[] = [];
  const listener = (event: KeyboardEvent) => { seen.push(event.code); };
  document.addEventListener('keydown', listener);
  try {
    expect(await press('n')).toBe(true);
  } finally {
    document.removeEventListener('keydown', listener);
  }
  expect(seen).toEqual(['KeyN']);
  expect(tabs()).toEqual([false]);
}, 20_000);
