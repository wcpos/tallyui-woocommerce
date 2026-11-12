import { EMPTY_CART_TEXT } from './cart-line-helpers';
import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { OpenOrderTabs, type OpenOrderTabsCurrent, type OpenOrderTabsParked } from '../components/open-order-tabs';
import { tabWho } from '../lib/sale/tab-who';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { openParkedList, parkedTabs, stripLayout } from './open-orders-helpers';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

const currency = 'USD';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-11-10T10:10:00.000Z');

function cart(id: string, parkedAt: string, names: string[], totalMinor: number, customer?: { name: string }): OpenOrderTabsParked {
  return { id, parkedAt, totalMinor, lines: names.map(name => ({ name })), customer };
}

function order(names: string[], totalMinor: number): OpenOrderTabsCurrent {
  return { id: 'current', lineItems: names.map(name => ({ name })), customer: null, totalMinor };
}

function handlers() {
  return { onSelect: vi.fn(async (_id: string): Promise<string | null> => null), onNew: vi.fn(async (): Promise<string | null> => null), onError: vi.fn() };
}

function tabIds() {
  return within(screen.getByTestId('open-order-strip')).getAllByRole('tab').map(tab => tab.getAttribute('data-testid'));
}

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => {
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('tabWho reads the customer first, then the contents', () => {
  expect(tabWho({ customerName: 'Gee Four', lines: [{ name: 'Espresso' }] })).toBe('Gee Four');
  expect(tabWho({ customerName: '  ', lines: [{ name: 'Espresso' }] })).toBe('Guest · Espresso');
  expect(tabWho({ lines: [{ name: 'Espresso' }], fees: [{ name: 'Service' }] })).toBe('Guest · 2 items');
  expect(tabWho({ lines: [{ name: 'Espresso' }, { name: 'Cold Brew' }], shipping: [{ name: 'Flat rate' }] })).toBe('Guest · 3 items');
  expect(tabWho({ lines: [], shipping: [{ name: 'Flat rate' }] })).toBe('Guest · Flat rate shipping');
  expect(tabWho({ lines: [], fees: [{ name: 'Service' }] })).toBe('Guest · Service');
  expect(tabWho({ lines: [] })).toBe('Guest');
  expect(tabWho({ lines: [{ name: ' ' }] })).toBe('Guest');
});

test('lists parked carts oldest first, then the current sale, then the + cell', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew', 'Espresso'], 700),
      cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300, { name: 'Gee Four' })]}
    current={order(['Espresso'], 300)} />);
  expect(tabIds()).toEqual(['open-order-tab-a', 'open-order-tab-b', 'open-order-tab-current', 'new-order-tab']);
  expect(screen.getByTestId('open-order-tab-a').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('open-order-tab-b').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('open-order-tab-current').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('new-order-tab').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('open-order-tab-a-who').textContent).toBe('Gee Four');
  expect(screen.getByTestId('open-order-tab-b-who').textContent).toBe('Guest');
  expect(screen.getByTestId('open-order-tab-current-who').textContent).toBe('Guest');
  expect(screen.getByTestId('open-order-tab-a-amount').textContent).toBe('$3.00');
  expect(screen.getByTestId('open-order-tab-b-amount').textContent).toBe('$7.00');
  expect(screen.queryByTestId('new-order-tab-label')).toBeNull();
});

test('on a blank cart + is the selected New tab and pressing it does nothing', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300)]} current={order([], 0)} />);
  expect(tabIds()).toEqual(['open-order-tab-a', 'new-order-tab']);
  const plus = screen.getByTestId('new-order-tab');
  expect(plus.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByLabelText('New order')).toBe(plus);
  expect(screen.getByTestId('new-order-tab-label').textContent).toBe('New');
  fireEvent.click(plus);
  expect(onNew).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
});

test('+ with a sale in the cart parks it through onNew', async () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError}
    parked={[]} current={order(['Espresso'], 300)} />);
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(onNew).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

test('pressing the current tab does nothing', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300)]} current={order(['Espresso'], 300)} />);
  fireEvent.click(screen.getByTestId('open-order-tab-current'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(onNew).not.toHaveBeenCalled();
});

test('a parked tab switches through onSelect and ignores taps until it settles', async () => {
  const { onNew, onError } = handlers();
  let resolve: (value: string | null) => void = () => {};
  const onSelect = vi.fn((_id: string) => new Promise<string | null>(done => { resolve = done; }));
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)]}
    current={order(['Espresso'], 300)} />);
  fireEvent.click(screen.getByTestId('open-order-tab-a'));
  expect(onSelect).toHaveBeenCalledWith('a');
  fireEvent.click(screen.getByTestId('open-order-tab-b'));
  fireEvent.click(screen.getByTestId('new-order-tab'));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onNew).not.toHaveBeenCalled();
  await act(async () => resolve(null));
  fireEvent.click(screen.getByTestId('open-order-tab-b'));
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(onSelect).toHaveBeenLastCalledWith('b');
});

test('a refusal from onSelect or onNew reaches onError', async () => {
  const onSelect = vi.fn(async (_id: string): Promise<string | null> => 'The catalogue is still syncing. Try again in a moment.');
  const onNew = vi.fn(async (): Promise<string | null> => 'disk full');
  const onError = vi.fn();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300)]} current={order(['Espresso'], 300)} />);
  await act(async () => { fireEvent.click(screen.getByTestId('open-order-tab-a')); });
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(onError.mock.calls).toEqual([['The catalogue is still syncing. Try again in a moment.'], ['disk full']]);
});

test('sale screen: + parks the sale into a tab and the tab brings it back', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByTestId('new-order-tab').getAttribute('aria-selected')).toBe('true');

  fireEvent.click(screen.getByText('Espresso'));
  expect(tabIds()).toHaveLength(2);
  const strip = () => within(screen.getByTestId('open-order-strip')).getAllByRole('tab');
  expect(strip()[0].textContent).toBe('Guest$3.00');
  expect(screen.getByTestId('new-order-tab').getAttribute('aria-selected')).toBe('false');

  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(screen.getByText(EMPTY_CART_TEXT)).not.toBeNull();
  expect(tabIds()).toHaveLength(2);
  expect(screen.getByTestId('new-order-tab').getAttribute('aria-selected')).toBe('true');
  expect(parkedTabs()).toHaveLength(1);

  fireEvent.click(screen.getByText('Cold Brew'));
  expect(tabIds()).toHaveLength(3);
  await act(async () => { fireEvent.click(strip()[0]); });
  await screen.findByLabelText('Edit quantity of Espresso');
  expect(screen.queryByLabelText('Edit quantity of Cold Brew')).toBeNull();
  expect(tabIds()).toHaveLength(3);
  expect(strip()[0].textContent).toBe('Guest$4.00');
  expect(parkedTabs()).toHaveLength(1);
}, 20_000);

test('sale screen (e): nothing above the cart parks or lists; the strip\'s count cell opens the parked sheet', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(parkedTabs()).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Park cart' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Parked \(/ })).toBeNull();
  stripLayout(640, 300);
  expect(screen.queryByTestId('open-orders-count')).toBeNull();
  openParkedList();
  expect(screen.getByRole('button', { name: '2 open' })).not.toBeNull();
  const sheet = within(screen.getByTestId('parked-sales'));
  expect(sheet.getByText('1 item')).not.toBeNull();
  expect(sheet.getByText('$3.00')).not.toBeNull();
}, 20_000);

test('(a) a cart parked 5 h ago reads its amount, then its age', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('a', new Date(NOW - 5 * HOUR).toISOString(), ['Espresso'], 1683)]} current={order([], 0)} />);
  expect(screen.getByTestId('open-order-tab-a-amount').textContent).toBe('$16.83 · 5 h');
  const age = screen.getByTestId('open-order-tab-a-age');
  expect(age.textContent).toBe('5 h');
});

test('(b) a cart under an hour old shows no age until the minute tick crosses the hour', () => {
  vi.useFakeTimers();
  try {
    let now = NOW;
    const { onSelect, onNew, onError } = handlers();
    render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => now}
      parked={[cart('a', new Date(NOW - 59 * MINUTE).toISOString(), ['Espresso'], 300)]} current={order([], 0)} />);
    expect(screen.queryByTestId('open-order-tab-a-age')).toBeNull();
    expect(screen.getByTestId('open-order-tab-a-amount').textContent).toBe('$3.00');
    now = NOW + MINUTE;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('open-order-tab-a-age').textContent).toBe('1 h');
    expect(screen.getByTestId('open-order-tab-a-amount').textContent).toBe('$3.00 · 1 h');
  } finally {
    vi.useRealTimers();
  }
});

test('(c) the current sale\'s tab never shows an age', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW + 48 * HOUR}
    parked={[]} current={order(['Espresso'], 300)} />);
  expect(screen.getByTestId('open-order-tab-current-amount').textContent).toBe('$3.00');
  expect(screen.queryByTestId('open-order-tab-current-age')).toBeNull();
});

test('(d) the open-orders count cell shows only when the tabs overflow, and opens the list', () => {
  const { onSelect, onNew, onError } = handlers();
  const onOpenList = vi.fn();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} onOpenList={onOpenList} now={() => NOW}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)]}
    current={order(['Espresso'], 300)} />);
  expect(screen.queryByTestId('open-orders-count')).toBeNull();
  // 500 of tabs fit 640 less the 112 reserved for +.
  stripLayout(640, 500);
  expect(screen.queryByTestId('open-orders-count')).toBeNull();
  stripLayout(640, 600);
  const count = screen.getByTestId('open-orders-count');
  expect(count.getAttribute('role')).toBe('button');
  expect(screen.getByRole('button', { name: '3 open' })).toBe(count);
  expect(count.textContent).toContain('3');
  fireEvent.click(count);
  expect(onOpenList).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
  expect(onNew).not.toHaveBeenCalled();
  stripLayout(640, 500);
  expect(screen.queryByTestId('open-orders-count')).toBeNull();
});

// B12: v2 TabContent's `phone`: one line, the name then the amount. jsdom applies no layout classes, so read the direction.
const tabContent = (id: string) => screen.getByTestId(`open-order-tab-${id}-content`);
const direction = (node: HTMLElement) => node.style.flexDirection;

test('compact: a tab is one row, the name then the amount, and a stale cart keeps its age', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('a', new Date(NOW - 5 * HOUR).toISOString(), ['Espresso'], 1683)]} current={order([], 0)} />);
  const content = tabContent('a');
  expect(direction(content)).toBe('row');
  expect(Array.from(content.children).map(child => child.getAttribute('data-testid'))).toEqual(['open-order-tab-a-who', 'open-order-tab-a-amount']);
  expect(screen.getByTestId('open-order-tab-a-amount').textContent).toBe('$16.83 · 5 h');
  expect(screen.getByTestId('open-order-tab-a-age').textContent).toBe('5 h');
});

test('wide: a tab stacks the name over the amount', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('a', new Date(NOW - 5 * HOUR).toISOString(), ['Espresso'], 1683)]} current={order([], 0)} />);
  expect(direction(tabContent('a'))).toBe('column');
});

test.each([[390, 'row'], [1280, 'column']])('sale screen at %spx: the current sale\'s tab lays out as a %s', (width, expected) => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(direction(screen.getByTestId(/^open-order-tab-.+-content$/))).toBe(expected);
});

// B12: v2 seeds a walk-in cart with the guest's name (use-guest-customer.ts), so every tab reads "Guest $16.83", phone or wide.
test.each([true, false])('compact %s: a guest cart of three lines reads Guest and the amount, never its items; a customer keeps the name', compact => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact={compact} currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300, { name: 'Gee Four' })]}
    current={order(['Cold Brew', 'Espresso', 'Croissant'], 1050)} />);
  expect(screen.getByTestId('open-order-tab-current-who').textContent).toBe('Guest');
  expect(screen.getByTestId('open-order-tab-current-amount').textContent).toBe('$10.50');
  expect(screen.getByTestId('open-order-tab-current').textContent).not.toContain('items');
  expect(screen.getByTestId('open-order-tab-a-who').textContent).toBe('Gee Four');
});

test('compact: the count cell shows on overflow, as v2\'s does on a phone, and opens the list', () => {
  const { onSelect, onNew, onError } = handlers();
  const onOpenList = vi.fn();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} onOpenList={onOpenList} now={() => NOW}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)]}
    current={order(['Espresso'], 300)} />);
  // A 390 phone: three tabs of ~105 overflow 390 less the 112 reserved for +.
  stripLayout(390, 315);
  const count = screen.getByRole('button', { name: '3 open' });
  expect(count.textContent).toContain('3');
  fireEvent.click(count);
  expect(onOpenList).toHaveBeenCalledTimes(1);
});

// v2 cart/tabs.tsx gives every tab minWidth TAB_MIN (96, cart/tab-window.ts), so short labels still overflow.
test('every tab is at least 96 wide, and three short tabs overflow a 390 strip as v2\'s do', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)]}
    current={order(['Espresso'], 300)} />);
  expect(screen.getByTestId('open-order-tab-a').style.minWidth).toBe('96px');
  // Three 80 labels (240) fit 390 less the 112 for +; three 96 tabs (288) do not.
  stripLayout(390, 240);
  expect(screen.getByRole('button', { name: '3 open' }).textContent).toContain('3');
});

test('the count cell\'s chevron points up while the list is closed and down while it is open; the label stays', () => {
  const { onSelect, onNew, onError } = handlers();
  const parked = [cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)];
  const strip = (listOpen: boolean) => <OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    listOpen={listOpen} parked={parked} current={order(['Espresso'], 300)} />;
  const { rerender } = render(strip(false));
  stripLayout(640, 600);
  const count = screen.getByRole('button', { name: '3 open' });
  expect(within(count).queryByTestId('open-orders-chevron-up')).not.toBeNull();
  expect(within(count).queryByTestId('open-orders-chevron-down')).toBeNull();
  expect(count.textContent).not.toContain('▴');
  rerender(strip(true));
  expect(within(count).queryByTestId('open-orders-chevron-down')).not.toBeNull();
  expect(within(count).queryByTestId('open-orders-chevron-up')).toBeNull();
  expect(screen.getByRole('button', { name: '3 open' })).toBe(count);
});

// A1/B12: v2 cart/tabs.tsx scrolls its strip so the open tab sits in view: centred (tab-window.ts centredOffset), clamped
// to the row's ends; landing on first layout, sliding after. jsdom measures nothing, so the test reports each size.
type Measured = Element & { __reactLayoutHandler: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void };
const measure = (node: Element | null, width: number) =>
  (node as Measured).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width, height: 52 } } });

/** Report every tab's width, the tabs' content width, the strip's width and, last, the ScrollView's own width. */
function rowLayout(strip: number, viewport: number, tabWidths: Record<string, number>) {
  act(() => {
    for (const [id, width] of Object.entries(tabWidths)) measure(screen.getByTestId(`open-order-tab-${id}`), width);
    const scroll = screen.getByTestId('open-order-scroll');
    measure(scroll.firstElementChild, Object.values(tabWidths).reduce((sum, width) => sum + width, 0));
    measure(screen.getByTestId('open-order-strip'), strip);
    measure(scroll, viewport);
  });
}

// RNW puts the ScrollView's scrollTo on its host node, the node the component's ref holds.
const spyScrollTo = () => vi.spyOn(screen.getByTestId('open-order-scroll') as unknown as { scrollTo: (options: { x: number; animated: boolean }) => void }, 'scrollTo');

const twoParked = [cart('a', '2026-11-10T10:00:00.000Z', ['Espresso'], 300), cart('b', '2026-11-10T10:05:00.000Z', ['Cold Brew'], 400)];

test('phone, three open orders: the strip scrolls to the open last tab on first layout, without a slide', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={twoParked} current={order(['Espresso'], 300)} />);
  const scrollTo = spyScrollTo();
  // 390 less the count cell (56) and + (48): a 286 row; three 105 tabs make 315.
  rowLayout(390, 286, { a: 105, b: 105, current: 105 });
  // centredOffset: 210 + 52.5 - 143 = 119.5, clamped to the row's end, 315 - 286 = 29.
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 29, animated: false });
});

test('an open tab wider than the row is centred, not left-aligned and not clamped to the row\'s end', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={twoParked} current={{ ...order(['Espresso'], 300), customer: { name: 'Bartholomew Featherstonehaugh-Smythe' } }} />);
  const scrollTo = spyScrollTo();
  // A 320 phone less the count cell (56) and + (48): a 216 row; the open sale's long name makes its tab 240, past the row.
  rowLayout(320, 216, { a: 105, b: 105, current: 240 });
  // centredOffset: 210 + 120 - 108 = 222, under the row's end 450 - 216 = 234; a left-aligned tab would sit at 210.
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 222, animated: false });
});

test('selecting the first tab scrolls the strip to it once it is the open sale, sliding', async () => {
  const { onSelect, onNew, onError } = handlers();
  const strip = (parked: OpenOrderTabsParked[], current: OpenOrderTabsCurrent) => <OpenOrderTabs compact currency={currency}
    onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW} parked={parked} current={current} />;
  const { rerender } = render(strip(twoParked, order(['Espresso'], 300)));
  const scrollTo = spyScrollTo();
  rowLayout(390, 286, { a: 105, b: 105, current: 105 });
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 29, animated: false });
  await act(async () => { fireEvent.click(screen.getByTestId('open-order-tab-a')); });
  expect(onSelect).toHaveBeenCalledWith('a');
  // Tally's resume parks the open sale as the newest cart, so the cart picked becomes the open sale, at the right.
  rerender(strip([twoParked[1], cart('was-open', '2026-11-10T10:10:00.000Z', ['Espresso'], 300)],
    { id: 'a', lineItems: [{ name: 'Espresso' }], customer: null, totalMinor: 300 }));
  expect(screen.getByTestId('open-order-tab-a').getAttribute('aria-selected')).toBe('true');
  rowLayout(390, 286, { b: 105, 'was-open': 105, a: 140 });
  // 210 + 70 - 143 = 137, clamped to 350 - 286 = 64.
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 64, animated: true });
});

test('on the blank cart the strip scrolls to its end, where + is the open tab', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs compact currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={[...twoParked, cart('c', '2026-11-10T10:07:00.000Z', ['Croissant'], 500)]} current={order([], 0)} />);
  const scrollTo = spyScrollTo();
  // 390 less the count cell (56) and the unfolded + (112): a 222 row; 315 of tabs.
  rowLayout(390, 222, { a: 105, b: 105, c: 105 });
  expect(scrollTo).toHaveBeenLastCalledWith({ x: 93, animated: false });
});

test('tabs that fit the strip are never scrolled', () => {
  const { onSelect, onNew, onError } = handlers();
  render(<OpenOrderTabs currency={currency} onSelect={onSelect} onNew={onNew} onError={onError} now={() => NOW}
    parked={twoParked} current={order(['Espresso'], 300)} />);
  const scrollTo = spyScrollTo();
  rowLayout(1280, 1232, { a: 100, b: 100, current: 100 });
  expect(screen.queryByTestId('open-orders-count')).toBeNull();
  expect(scrollTo).not.toHaveBeenCalled();
});
