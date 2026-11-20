import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { StoreOrder } from '@tallyui/core';
import { OrderDetailView } from '../components/order-detail';
import { classesOf, textPropsOf } from './classes-of';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function make(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z', currency: 'USD',
    pricesIncludeTax: false, customer: null,
    lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
    fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
    payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
    discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600, ...overrides,
  };
}

const show = (order: StoreOrder) => render(<OrderDetailView order={order} onReceipt={vi.fn()} onClose={vi.fn()} />);
const part = (testID: string) => within(screen.getByTestId(testID));
// v2's phone layout (orders/view/sections/line-items.tsx, useIsPhone = the app's !useIsWide()); jsdom's innerHeight is 768.
const windowOf = (width: number, height: number) =>
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height, scale: 1, fontScale: 1 });

// Avatar puts its tone on the fallback disc inside it (bg-primary / bg-muted, @tallyui/components avatarFallbackVariants);
// react-native-web drops className from the DOM, so read it off the nearest component above that disc (as classesOf).
type Fiber = { type?: unknown; memoizedProps?: { className?: unknown }; return?: Fiber; alternate?: Fiber };
function avatarDiscClasses(): string[] {
  const disc = screen.getByTestId('order-modal-customer-avatar').firstElementChild as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(disc).find(name => name.startsWith(prefix))!;
  const created = disc[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === disc[key('__reactProps$')] ? created : created.alternate;
  for (; fiber; fiber = fiber.return) {
    const { className } = fiber.memoizedProps ?? {};
    if (typeof fiber.type !== 'string' && typeof className === 'string') return className.split(/\s+/); // skip the DOM node's own css-view class
  }
  return [];
}

test('the header shows v2\'s order title, its status and when it was placed', () => {
  show(make());
  expect(screen.getByTestId('order-modal-title').textContent).toBe('Order #901');
  expect(classesOf('order-modal-title')).toEqual(expect.arrayContaining(['text-lg', 'leading-none'])); // v2's dialog rank
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Completed');
});

// v2's OrderIdentity `dateTime` (orders/edit/view.tsx:33-70, hooks/use-store-day-label.ts:20-26), on a fixed local clock.
function placedOn(placed: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0));
  try {
    show(make({ placedAt: placed.toISOString() }));
    return screen.getByTestId('order-modal-identity').textContent;
  } finally {
    vi.useRealTimers();
  }
}

test('the identity line reads Today · HH:MM for an order placed today', () => {
  expect(placedOn(new Date(2026, 9, 15, 10, 51))).toBe('Today · 10:51');
  expect(classesOf('order-modal-identity')).toEqual(expect.arrayContaining(['text-sm', 'text-muted-foreground'])); // v2's key rank
});

test('the identity line reads Yesterday · HH:MM for an order placed yesterday', () => {
  expect(placedOn(new Date(2026, 9, 14, 9, 5))).toBe('Yesterday · 09:05');
});

test("an older order's identity line shows its weekday, date and time", () => {
  expect(placedOn(new Date(2026, 9, 12, 8, 0))).toBe('Mon 12 Oct · 08:00');
});

test("the item heads are v2's caption rank: QTY ITEM PRICE TOTAL", () => {
  windowOf(1280, 800);
  show(make());
  for (const [key, word] of [['qty', 'Qty'], ['item', 'Item'], ['price', 'Price'], ['total', 'Total']]) {
    expect(screen.getByTestId(`order-modal-head-${key}`).textContent).toBe(word);
    const classes = classesOf(`order-modal-head-${key}`);
    expect(classes).toEqual(expect.arrayContaining(['text-xs', 'uppercase', 'tracking-wide', 'text-muted-foreground']));
    expect(classes).not.toContain('font-semibold');
  }
});

test('an unknown status word is capitalised', () => {
  show(make({ status: 'awaiting-pickup' }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Awaiting-pickup');
});

test('a pos-open order\'s status reads POS open', () => {
  show(make({ status: 'pos-open' }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('POS open');
});

test('a partly refunded order reads Partially refunded and closes on Net Payment', () => {
  show(make({ refunds: [{ id: 'r1', amountMinor: 200 }] }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Partially refunded');
  expect(part('order-modal-total-refund').getByText('Refund')).not.toBeNull();
  expect(part('order-modal-total-refund').getByText('-$2.00')).not.toBeNull();
  expect(part('order-modal-total-total').getByText('Net Payment')).not.toBeNull();
  expect(part('order-modal-total-total').getByText('$4.00')).not.toBeNull();
  cleanup();
  show(make({ status: 'refunded', refunds: [{ id: 'r1', amountMinor: 600 }] }));
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Refunded');
});

test('items show qty, unit price and line total, a struck original price when discounted, and fees after them', () => {
  windowOf(1280, 800);
  show(make({
    lines: [
      { id: '1', name: 'Espresso', sku: 'ESP-1', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 },
      { id: '2', name: 'Latte', quantity: 1, subtotalMinor: 500, subtotalTaxMinor: 0, totalMinor: 400, taxMinor: 0 },
    ],
    fees: [{ name: 'Service', totalMinor: 100, taxMinor: 0 }],
  }));
  for (const head of ['Qty', 'Item', 'Price', 'Total']) expect(part('order-modal-items').getByText(head)).not.toBeNull();
  for (const text of ['2', 'Espresso', 'ESP-1', '$3.00', '$6.00']) expect(part('order-modal-line-0').getByText(text)).not.toBeNull();
  expect(screen.queryByTestId('order-modal-line-0-was')).toBeNull();
  expect(screen.getByTestId('order-modal-line-1-was').textContent).toBe('$5.00');
  expect(part('order-modal-line-1').getAllByText('$4.00')).toHaveLength(2);
  for (const text of ['Service', 'Fees', '$1.00']) expect(part('order-modal-fee-0').getByText(text)).not.toBeNull();
});

const showItems = () => show(make({
  lines: [
    { id: '1', name: 'Espresso', sku: 'ESP-1', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 },
    { id: '2', name: 'Latte', quantity: 1, subtotalMinor: 500, subtotalTaxMinor: 0, totalMinor: 400, taxMinor: 0 },
  ],
  fees: [{ name: 'Service', totalMinor: 100, taxMinor: 0 }],
}));

// v2 line-items.tsx:99-100, :153, :173.
test('on a phone the items table drops the Price column: no Price head, no Price cell on a line, no Price spacer on a fee', () => {
  windowOf(390, 844);
  showItems();
  for (const id of ['head-price', 'line-0-price', 'line-1-price', 'fee-0-price']) expect(screen.queryByTestId(`order-modal-${id}`)).toBeNull();
  for (const head of ['qty', 'item', 'total']) expect(screen.getByTestId(`order-modal-head-${head}`)).not.toBeNull();
});

// v2 line-items.tsx:84-95: "$4.00 · " then the original struck through when discounted, else just the unit.
test("on a phone each line's sub-line carries its unit price, the original struck beside it when discounted", () => {
  windowOf(390, 844);
  showItems();
  expect(screen.getByTestId('order-modal-line-0-unit').textContent).toBe('$3.00');
  expect(screen.queryByTestId('order-modal-line-0-was')).toBeNull();
  expect(screen.getByTestId('order-modal-line-1-unit').textContent).toBe('$4.00 · $5.00');
  const was = screen.getByTestId('order-modal-line-1-was');
  expect(was.textContent).toBe('$5.00');
  expect(screen.getByTestId('order-modal-line-1-unit').contains(was)).toBe(true);
  expect(classesOf('order-modal-line-1-was')).toEqual(expect.arrayContaining(['line-through', 'text-muted-foreground/70']));
  expect(classesOf('order-modal-line-1-unit')).toEqual(expect.arrayContaining(['text-xs', 'text-muted-foreground', 'tabular-nums']));
});

// v2 line-items.tsx:140-141.
test("on a phone a fee row shows v2's 28px tile with a primary + in its Qty cell", () => {
  windowOf(390, 844);
  showItems();
  const tile = screen.getByTestId('order-modal-fee-0-tile');
  expect(tile.textContent).toBe('+');
  expect(classesOf('order-modal-fee-0-tile')).toEqual(expect.arrayContaining(['h-7', 'w-7', 'rounded', 'bg-primary/10']));
  expect(textPropsOf(within(tile).getByText('+')).classes).toEqual(expect.arrayContaining(['text-primary', 'text-base', 'font-semibold']));
});

test('on a wide window the items table keeps its Price column and no phone sub-line or fee tile', () => {
  windowOf(1280, 800);
  showItems();
  for (const id of ['head-price', 'line-0-price', 'line-1-price', 'fee-0-price']) expect(screen.getByTestId(`order-modal-${id}`)).not.toBeNull();
  expect(screen.getByTestId('order-modal-line-1-was').textContent).toBe('$5.00');
  expect(screen.getByTestId('order-modal-line-1-price').contains(screen.getByTestId('order-modal-line-1-was'))).toBe(true);
  for (const id of ['line-0-unit', 'line-1-unit', 'fee-0-tile']) expect(screen.queryByTestId(`order-modal-${id}`)).toBeNull();
});

test('an order with no lines says so', () => {
  show(make({ lines: [] }));
  expect(part('order-modal-items').getByText('No line items.')).not.toBeNull();
  expect(part('order-modal-items').queryByText('Qty')).toBeNull();
});

test('totals show the discount with its coupon codes, shipping with its method, fees and tax by rate', () => {
  show(make({
    coupons: [{ code: 'SAVE10', discountMinor: 100, discountTaxMinor: 0 }], discountMinor: 100,
    shipping: [{ name: 'Flat rate', totalMinor: 500, taxMinor: 0 }], fees: [{ name: 'Service', totalMinor: 100, taxMinor: 0 }],
    taxLines: [{ label: 'VAT', ratePpm: 200000, amountMinor: 120 }], taxMinor: 120, totalMinor: 1220,
  }));
  const rows: [string, string[]][] = [
    ['subtotal', ['Subtotal', '$6.00']], ['discount', ['Discount', 'SAVE10', '-$1.00']],
    ['shipping', ['Shipping', '· Flat rate', '$5.00']], ['fees', ['Fees', '$1.00']], ['tax', ['Tax', '$1.20']],
    ['tax-0', ['VAT 20%', '$1.20']], ['total', ['Total', '$12.20']],
  ];
  for (const [row, texts] of rows) {
    for (const text of texts) expect(part(`order-modal-total-${row}`).getByText(text)).not.toBeNull();
  }
  expect(screen.queryByTestId('order-modal-total-refund')).toBeNull();
  cleanup();
  show(make());
  for (const row of ['discount', 'shipping', 'fees', 'tax']) expect(screen.queryByTestId(`order-modal-total-${row}`)).toBeNull();
});

test('a tax-inclusive order shows gross figures', () => {
  show(make({
    pricesIncludeTax: true,
    lines: [{ id: '1', name: 'Espresso', quantity: 1, subtotalMinor: 500, subtotalTaxMinor: 100, totalMinor: 500, taxMinor: 100 }],
    taxMinor: 100, totalMinor: 600,
  }));
  expect(part('order-modal-line-0').getAllByText('$6.00')).toHaveLength(2);
  expect(part('order-modal-total-subtotal').getByText('$6.00')).not.toBeNull();
});

test('payments are listed by the store\'s name, titled Payments when there are several', () => {
  show(make());
  expect(part('order-modal-payments').getByText('Payment')).not.toBeNull();
  expect(screen.getAllByTestId('order-modal-payment')).toHaveLength(1);
  expect(part('order-modal-payment').getByText('Cash')).not.toBeNull();
  expect(part('order-modal-payment').getByText('$6.00')).not.toBeNull();
  cleanup();
  show(make({ payments: [{ method: 'pos_cash', title: 'Cash', amountMinor: 400 }, { method: 'stripe', amountMinor: 200 }] }));
  expect(part('order-modal-payments').getByText('Payments')).not.toBeNull();
  const payments = screen.getAllByTestId('order-modal-payment');
  expect(payments).toHaveLength(2);
  expect(within(payments[1]).getByText('stripe')).not.toBeNull();
  expect(within(payments[1]).getByText('$2.00')).not.toBeNull();
  cleanup();
  show(make({ payments: [] }));
  expect(screen.queryByTestId('order-modal-payments')).toBeNull();
});

test('refunds show their own section after Payment: count, total and one card per refund with its reason', () => {
  show(make({ totalMinor: 600, refunds: [{ id: '31', amountMinor: 200, reason: 'Damaged cup' }, { id: '30', amountMinor: 100 }] }));
  expect(part('order-modal-refunds').getByText('Refunds')).not.toBeNull();
  expect(screen.getByTestId('order-modal-refunds-summary').textContent).toBe('2 refunds · -$3.00');
  expect(part('order-modal-refund-31').getByText('Refund #31')).not.toBeNull();
  expect(part('order-modal-refund-31').getByText('-$2.00')).not.toBeNull();
  expect(screen.getByTestId('order-modal-refund-reason-31').textContent).toBe('“Damaged cup”');
  expect(part('order-modal-refund-30').getByText('-$1.00')).not.toBeNull();
  expect(screen.queryByTestId('order-modal-refund-reason-30')).toBeNull();
  expect(screen.getByTestId('order-modal-refunds').querySelector('[data-testid^="order-modal-refund-3"]')?.getAttribute('data-testid')).toBe('order-modal-refund-31');
  const [payments, refunds, customer] = ['order-modal-payments', 'order-modal-refunds', 'order-modal-customer'].map(id => screen.getByTestId(id));
  expect(payments.compareDocumentPosition(refunds) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(refunds.compareDocumentPosition(customer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('one refund reads 1 refund', () => {
  show(make({ refunds: [{ id: '7', amountMinor: 600 }] }));
  expect(screen.getByTestId('order-modal-refunds-summary').textContent).toBe('1 refund · -$6.00');
});

test('an order with no refunds has no Refunds section', () => {
  show(make());
  expect(screen.queryByTestId('order-modal-refunds')).toBeNull();
});

test('the customer is named with the email, and Guest when there is none', () => {
  show(make());
  expect(part('order-modal-customer').getByText('Guest')).not.toBeNull();
  cleanup();
  show(make({ customer: { id: '7', name: 'Ada Lovelace', email: 'ada@example.com' } }));
  expect(part('order-modal-customer').getByText('Ada Lovelace')).not.toBeNull();
  expect(part('order-modal-customer').getByText('ada@example.com')).not.toBeNull();
});

test('the name line falls back as v2: email for a nameless registered customer, then "ID: {id}", and Guest for a guest', () => {
  // v2 orders/view/sections/customer.tsx:65-69 names the customer with hooks/use-customer-name-format.
  show(make({ customer: { id: '8', email: 'jane.doe@shop.example' } }));
  expect(part('order-modal-customer').getAllByText('jane.doe@shop.example')).toHaveLength(2); // the name line and the email line
  expect(part('order-modal-customer').queryByText('Guest')).toBeNull();
  cleanup();
  show(make({ customer: { id: '9' } }));
  expect(part('order-modal-customer').getByText('ID: 9')).not.toBeNull();
  expect(part('order-modal-customer').queryByText('Guest')).toBeNull();
  cleanup();
  show(make({ customer: null }));
  expect(part('order-modal-customer').getByText('Guest')).not.toBeNull();
});

test('a customer order shows the customer\'s initials avatar beside the name, as v2 (sections/customer.tsx:79)', () => {
  show(make({ customer: { id: '7', name: 'Ada Lovelace', email: 'shopper@example.com' } }));
  const avatar = screen.getByTestId('order-modal-customer-avatar');
  expect(avatar.textContent).toBe('AL');
  expect(part('order-modal-customer').getByTestId('order-modal-customer-avatar')).toBe(avatar);
  // v2 user-avatar/customer-avatar.tsx: a customer gets the primary disc.
  expect(avatarDiscClasses()).toContain('bg-primary');
  expect(avatarDiscClasses()).not.toContain('bg-muted');
});

test('a registered customer with no name reads by the email\'s local part, as v2', () => {
  show(make({ customer: { id: '8', email: 'jane.doe@shop.example' } }));
  expect(screen.getByTestId('order-modal-customer-avatar').textContent).toBe('JA');
});

test.each([null, { email: 'walkin@example.com' }])('a guest order shows v2\'s Guest avatar, never initials', customer => {
  show(make({ customer }));
  const avatar = screen.getByTestId('order-modal-customer-avatar');
  expect(avatar).not.toBeNull();
  expect(avatar.textContent).toBe('');
  // v2 helpers.ts:56-57: a guest order with an email is named by it; with nothing, Guest.
  expect(part('order-modal-customer').getAllByText(customer?.email ?? 'Guest').length).toBeGreaterThan(0);
  // v2 user-avatar/customer-avatar.tsx: a nameless guest gets the muted disc.
  expect(avatarDiscClasses()).toContain('bg-muted');
  expect(avatarDiscClasses()).not.toContain('bg-primary');
});

test('a guest order that carries a name shows its initials, as v2', () => {
  show(make({ customer: { name: 'Walk In' } }));
  expect(screen.getByTestId('order-modal-customer-avatar').textContent).toBe('WI');
  // v2 user-avatar/customer-avatar.tsx: a guest order carrying a name gets the primary disc.
  expect(avatarDiscClasses()).toContain('bg-primary');
  expect(avatarDiscClasses()).not.toContain('bg-muted');
});

test('Receipt and Close call their handlers', () => {
  const onReceipt = vi.fn();
  const onClose = vi.fn();
  render(<OrderDetailView order={make()} onReceipt={onReceipt} onClose={onClose} />);
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(onReceipt).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('order-modal-close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
