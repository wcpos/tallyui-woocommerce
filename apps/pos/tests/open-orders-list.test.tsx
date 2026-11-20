import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { formatMoney } from '@tallyui/core';
import { OpenOrdersList, type OpenOrdersListProps } from '../components/open-orders-list';
import { AGE_TICK_MS, stripCartIds } from '../components/open-order-tabs';
import { cartContentsLine, relativeAge } from '../lib/sale/cart-contents';
import { classesOf, textPropsOf } from './classes-of';

const currency = 'USD';
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-11-10T10:10:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

type Parked = OpenOrdersListProps['parked'][number];
type Current = OpenOrdersListProps['current'];

function parkedCart(id: string, parkedAt: string, lines: { name: string; quantity: number }[], totalMinor: number, customer?: { name: string }): Parked {
  return { id, parkedAt, totalMinor, lines, customer };
}

function currentCart(lines: { name: string; quantity: number }[], totalMinor = 500, customer: { name: string } | null = null): Current {
  return { id: 'current', lineItems: lines, customer, totalMinor };
}

function handlers() {
  return { onSelect: vi.fn(async (_id: string): Promise<string | null> => null), onClose: vi.fn(), onError: vi.fn() };
}

function show(props: Partial<OpenOrdersListProps> & Pick<OpenOrdersListProps, 'parked' | 'current'>) {
  const all = { ...handlers(), currency, now: () => NOW, ...props };
  render(<OpenOrdersList {...all} />);
  return all;
}

function rowIds() {
  return within(screen.getByTestId('open-orders-list')).getAllByRole('button')
    .map(row => row.getAttribute('data-testid')).filter(id => id?.startsWith('open-orders-row-'));
}

const money = (minor: number) => formatMoney({ amount: minor, currency }) ?? String(minor);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('cartContentsLine reads products, fees and shipping, counting from three entries', () => {
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: 1 }] })).toBe('A');
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: 1 }, { name: 'B', quantity: 2 }] })).toBe('A, B ×2');
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: 1 }, { name: 'B', quantity: 2 }], fees: [{ name: 'Tip' }], shipping: [{ name: 'Flat rate' }] }))
    .toBe('4 items · A, B ×2, Tip, Flat rate shipping');
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: 0 }, { name: '  ', quantity: 2 }, { name: 'B', quantity: null }] })).toBe('B');
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: -1 }] })).toBe('A ×-1');
  expect(cartContentsLine({ lines: [{ name: 'A', quantity: 1 }, { name: 'B', quantity: 1 }, { name: 'C', quantity: 1 }] })).toBe('3 items · A, B, C');
  expect(cartContentsLine({ lines: [] })).toBe('');
});

test('relativeAge follows v2 relative-time', () => {
  expect(relativeAge(NOW - 3 * SECOND, NOW)).toBe('just now');
  expect(relativeAge(NOW - 30 * SECOND, NOW)).toBe('30 seconds');
  expect(relativeAge(NOW - 4 * MINUTE, NOW)).toBe('4 min');
  expect(relativeAge(NOW - (59 * MINUTE + 40 * SECOND), NOW)).toBe('60 min');
  expect(relativeAge(NOW - 2 * HOUR, NOW)).toBe('2 h');
  expect(relativeAge(NOW + 10 * MINUTE, NOW)).toBe('just now');
});

test('rows follow the strip order and show who, what and how much', () => {
  const parked = [
    parkedCart('p-new', ago(10 * MINUTE), [{ name: 'Espresso', quantity: 2 }], 700),
    parkedCart('p-old', ago(30 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450, { name: 'Gee Four' }),
  ];
  const current = currentCart([{ name: 'Tea', quantity: 1 }], 300);
  show({ parked, current, currentOpenedAt: ago(20 * MINUTE) });
  expect(rowIds()).toEqual(stripCartIds(parked, current, ago(20 * MINUTE)).map(id => `open-orders-row-${id}`));
  expect(rowIds()).toEqual(['open-orders-row-p-old', 'open-orders-row-current', 'open-orders-row-p-new']);
  expect(screen.getByText('Open orders')).toBeTruthy();

  const named = within(screen.getByTestId('open-orders-row-p-old'));
  expect(named.getByText('Gee Four')).toBeTruthy();
  expect(named.getByText('GF')).toBeTruthy();
  expect(named.queryByTestId('customer-guest-icon')).toBeNull();
  expect(screen.getByTestId('open-orders-row-p-old-items').textContent).toBe('Latte');
  expect(named.getByText(money(450))).toBeTruthy();

  const guest = within(screen.getByTestId('open-orders-row-p-new'));
  expect(guest.getByText('Guest')).toBeTruthy();
  expect(guest.getByTestId('customer-guest-icon')).toBeTruthy();
  expect(screen.getByTestId('open-orders-row-p-new-items').textContent).toBe('Espresso ×2');
  expect(guest.getByText(money(700))).toBeTruthy();

  expect(screen.getByTestId('open-orders-row-current-items').textContent).toBe('Tea');
  expect(within(screen.getByTestId('open-orders-row-current')).getByText(money(300))).toBeTruthy();
});

test('the current cart is the selected row, and a blank current cart has no row', () => {
  const parked = [parkedCart('p1', ago(5 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450)];
  show({ parked, current: currentCart([{ name: 'Tea', quantity: 1 }]), currentOpenedAt: ago(MINUTE) });
  expect(classesOf('open-orders-row-current')).toEqual(expect.arrayContaining(['bg-muted', 'border-l-primary']));
  expect(classesOf('open-orders-row-current')).not.toContain('border-l-transparent');
  expect(classesOf('open-orders-row-p1')).toContain('border-l-transparent');
  expect(classesOf('open-orders-row-p1')).not.toContain('border-l-primary');
  expect(classesOf('open-orders-row-p1')).not.toContain('bg-muted');
  cleanup();

  show({ parked, current: currentCart([]) });
  expect(rowIds()).toEqual(['open-orders-row-p1']);
  expect(screen.queryByTestId('open-orders-row-current')).toBeNull();
});

test('the age reads the start time and turns the warning tone after an hour', () => {
  const parked = [
    parkedCart('fresh', ago(4 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450),
    parkedCart('stale', ago(2 * HOUR), [{ name: 'Mocha', quantity: 1 }], 500),
  ];
  show({ parked, current: currentCart([{ name: 'Tea', quantity: 1 }]) });
  expect(screen.getByTestId('open-orders-row-fresh-age').textContent).toBe('4 min');
  expect(classesOf('open-orders-row-fresh-age')).toContain('text-muted-foreground');
  expect(classesOf('open-orders-row-fresh-age')).not.toContain('text-warning-text');
  expect(screen.getByTestId('open-orders-row-stale-age').textContent).toBe('2 h');
  expect(classesOf('open-orders-row-stale-age')).toEqual(expect.arrayContaining(['text-warning-text', 'font-semibold']));
  // The current cart was never parked (no currentOpenedAt): no start time, no age.
  expect(screen.getByTestId('open-orders-row-current')).toBeTruthy();
  expect(screen.queryByTestId('open-orders-row-current-age')).toBeNull();
});

test('the ages tick, so a cart crossing an hour turns the warning tone', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  let clock = NOW;
  const parked = [parkedCart('p1', ago(HOUR - 30 * SECOND), [{ name: 'Latte', quantity: 1 }], 450)];
  show({ parked, current: currentCart([]), now: () => clock });
  expect(screen.getByTestId('open-orders-row-p1-age').textContent).toBe('60 min');
  expect(classesOf('open-orders-row-p1-age')).not.toContain('text-warning-text');
  clock = NOW + AGE_TICK_MS;
  act(() => { vi.advanceTimersByTime(AGE_TICK_MS); });
  expect(screen.getByTestId('open-orders-row-p1-age').textContent).toBe('1 h');
  expect(classesOf('open-orders-row-p1-age')).toContain('text-warning-text');
});

test('a parked row resumes then closes; the current row and Close only close', async () => {
  const parked = [parkedCart('p1', ago(5 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450)];
  const order: string[] = [];
  const onSelect = vi.fn(async (id: string) => { order.push(`select ${id}`); return null; });
  const onClose = vi.fn(() => { order.push('close'); });
  const { onError } = show({ parked, current: currentCart([{ name: 'Tea', quantity: 1 }]), currentOpenedAt: ago(MINUTE), onSelect, onClose });

  fireEvent.click(screen.getByTestId('open-orders-row-p1'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(order).toEqual(['select p1', 'close']);

  fireEvent.click(screen.getByTestId('open-orders-row-current'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  expect(onSelect).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('open-orders-close'));
  expect(onClose).toHaveBeenCalledTimes(3);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});

test('a refused or failed resume goes to onError, never a throw', async () => {
  const parked = [parkedCart('p1', ago(5 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450)];
  const refused = show({ parked, current: currentCart([]), onSelect: vi.fn(async () => 'Nope') });
  fireEvent.click(screen.getByTestId('open-orders-row-p1'));
  await waitFor(() => expect(refused.onError).toHaveBeenCalledWith('Nope'));
  cleanup();

  const failed = show({ parked, current: currentCart([]), onSelect: vi.fn(async (): Promise<string | null> => { throw new Error('Boom'); }) });
  fireEvent.click(screen.getByTestId('open-orders-row-p1'));
  await waitFor(() => expect(failed.onError).toHaveBeenCalledWith('Boom'));
});

// v2 cart/open-orders-list.tsx:112-121: the current row takes focus as the list opens, never while it is leaving.
test('the current row has focus after mount, unless the list is leaving', () => {
  const parked = [parkedCart('p1', ago(5 * MINUTE), [{ name: 'Latte', quantity: 1 }], 450)];
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  show({ parked, current: currentCart([{ name: 'Tea', quantity: 1 }]), currentOpenedAt: ago(MINUTE) });
  expect(document.activeElement).toBe(screen.getByTestId('open-orders-row-current'));
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  cleanup();
  focus.mockClear();

  show({ parked, current: currentCart([{ name: 'Tea', quantity: 1 }]), currentOpenedAt: ago(MINUTE), leaving: true });
  expect(document.activeElement).not.toBe(screen.getByTestId('open-orders-row-current'));
  expect(focus).not.toHaveBeenCalled();
});

// v2 cart/open-orders-list.tsx:52: the header text is plain.
test('the header text has no font-semibold', () => {
  show({ parked: [], current: currentCart([{ name: 'Tea', quantity: 1 }]) });
  expect(textPropsOf(screen.getByText('Open orders')).classes).not.toContain('font-semibold');
});
