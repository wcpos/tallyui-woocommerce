// Uniwind's runtime does not load under Vitest (theme-settings.test mocks it too); each colour reads back as the
// variable it was asked for, so a stroke names its chart token.
vi.mock('uniwind', () => ({ useCSSVariable: (names: string[]) => names.map(name => `var(${name})`) }));
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Donut, ReportCards, type DonutPart } from '../components/report-cards';
import type { CategoryFigures } from '../lib/reports/category-figures';
import type { ProductFigure } from '../lib/reports/product-figures';
import type { Period } from '../lib/reports/sales-room';
import { CARD_CLASSES, classesOf } from './classes-of';

afterEach(cleanup);

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const moneyWhole = (minor: number) => `$${Math.round(minor / 100).toLocaleString('en-US')}`;
const empty: Period = {
  count: 0, totalMinor: 0, taxMinor: 0, averageMinor: 0, items: 0, medianMinor: 0, largestMinor: null, discountMinor: 0,
  pending: 0, rejected: 0, splitCount: 0, byMethod: [], taxRates: [],
  byCashier: [],
};
const period: Period = {
  ...empty, count: 12, totalMinor: 157640, averageMinor: 13137, items: 23, medianMinor: 9850, largestMinor: 41000,
  discountMinor: 1250, splitCount: 0,
  byCashier: [
    { cashierRef: '7', count: 8, totalMinor: 98525 },
    { cashierRef: '9', count: 4, totalMinor: 59115 },
  ],
  byMethod: [
    { method: 'cash', label: 'Cash', count: 7, totalMinor: 98525 },
    { method: 'external', label: 'Card terminal', count: 5, totalMinor: 59115 },
  ],
};
const products: ProductFigure[] = [
  { key: 'p1', productId: 'p1', name: 'Espresso', quantity: 10, amountMinor: 59115 },
  { key: 'p2', productId: 'p2', name: 'Latte', quantity: 6, amountMinor: 39410 },
  { key: 'p3', productId: 'p3', name: 'Muffin', quantity: 4, amountMinor: 31528 },
  { key: 'p4', productId: 'p4', name: 'Bagel', quantity: 2, amountMinor: 15764 },
  { key: 'p5', productId: 'p5', name: 'Tea', quantity: 1, amountMinor: 11823 },
];
const categories: CategoryFigures = {
  parts: [
    { key: '10', label: 'Coffee', amountMinor: 78820, quantity: 3 },
    { key: '20', label: 'Bakery', amountMinor: 39410, quantity: 2 },
    { key: 'uncategorised', label: 'Uncategorised', amountMinor: 19705, quantity: 1 },
    { key: 'unknown', label: 'Unknown product', amountMinor: 19705, quantity: 1 },
  ], unknownLines: 1, totalLines: 5,
};
const text = (testID: string) => screen.getByTestId(testID).textContent;
type LayoutNode = HTMLElement & { __reactLayoutHandler(event: { nativeEvent: { layout: { width: number } } }): void };
// RNW attaches onLayout to the node; jsdom has no ResizeObserver, so the test reports the size.
const layout = (testID: string, width: number) =>
  act(() => (screen.getByTestId(testID) as LayoutNode).__reactLayoutHandler({ nativeEvent: { layout: { width } } }));
const cards = (props: Partial<Parameters<typeof ReportCards>[0]> = {}) => {
  const onOpenTable = vi.fn();
  render(<ReportCards period={period} money={money} moneyWhole={moneyWhole} onOpenTable={onOpenTable} {...props} />);
  return onOpenTable;
};

test('the Orders card reads the count and six stats, and opens the Orders table', () => {
  const onOpenTable = cards();
  expect(text('card-orders-figure')).toBe('12');
  expect(['average', 'median', 'largest', 'items', 'items-per-order', 'discounts'].map(id => text(`card-orders-${id}`)))
    .toEqual(['$131.37', '$98.50', '$410.00', '23', '1.9', '$12.50']);
  const card = within(screen.getByTestId('card-orders'));
  for (const label of ['Average order', 'Median', 'Largest', 'Items Sold', 'Items per order', 'Discounts']) {
    expect(card.getByText(label)).not.toBeNull();
  }
  expect(screen.queryByTestId('card-orders-empty')).toBeNull();
  fireEvent.click(screen.getByTestId('card-orders-open'));
  expect(onOpenTable).toHaveBeenCalledWith('orders');
});

test('the Orders card reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-orders-figure')).toBe('0');
  expect(text('card-orders-empty')).toBe('No orders in this period');
  expect(screen.queryByTestId('card-orders-average')).toBeNull();
});

test('Largest reads a dash with no largest order', () => {
  cards({ period: { ...period, largestMinor: null } });
  expect(text('card-orders-largest')).toBe('—');
});

test('the Payments card shows a donut row per method, and opens the Payments table', () => {
  const onOpenTable = cards();
  expect(text('card-payments-figure')).toBe('$1576.40');
  const donut = within(screen.getByTestId('card-payments-donut'));
  expect(donut.getAllByTestId(/^card-payments-donut-row-[a-z]+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-payments-donut-row-cash', 'card-payments-donut-row-external']);
  expect(text('card-payments-donut-row-cash-value')).toBe('$985.25');
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('62.5%')).not.toBeNull();
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('7 orders')).not.toBeNull();
  expect(text('card-payments-donut-row-external-value')).toBe('$591.15');
  expect(within(screen.getByTestId('card-payments-donut-row-external')).getByText('37.5%')).not.toBeNull();
  expect(text('card-payments-donut-figure')).toBe('$1,576');
  expect(donut.getByText('2 ways')).not.toBeNull();
  expect(screen.queryByText(/^Split tenders/)).toBeNull();
  fireEvent.click(screen.getByTestId('card-payments-open'));
  expect(onOpenTable).toHaveBeenCalledWith('payments');
  expect(onOpenTable).toHaveBeenCalledOnce();
});

test('one method reads 1 way and 1 order', () => {
  cards({ period: { ...period, count: 1, totalMinor: 300, byMethod: [{ method: 'cash', label: 'Cash', count: 1, totalMinor: 300 }] } });
  expect(within(screen.getByTestId('card-payments-donut')).getByText('1 way')).not.toBeNull();
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('1 order')).not.toBeNull();
  expect(within(screen.getByTestId('card-payments-donut-row-cash')).getByText('100%')).not.toBeNull();
});

test('the Payments card keeps the split tenders line, and reads an empty period', () => {
  cards({ period: { ...period, splitCount: 2 } });
  expect(within(screen.getByTestId('card-payments')).getByText('Split tenders: 2')).not.toBeNull();
  cleanup();
  cards({ period: empty });
  expect(text('card-payments-empty')).toBe('No payments in this period');
  expect(screen.queryByTestId('card-payments-donut')).toBeNull();
});

const parts = (values: number[]): DonutPart[] => values.map((value, index) => ({
  key: `p${index}`, label: `Part ${index}`, value, valueText: money(value), shareText: '',
}));
const arcs = (testID: string) => screen.getByTestId(testID).querySelectorAll('circle').length;

test('a donut part at or below zero draws no arc but keeps its row', () => {
  render(<Donut testID="donut" parts={parts([300, 0, -100, 200])} total={400} money={money} centre={{ figure: '$4', label: '4 ways' }} />);
  expect(arcs('donut')).toBe(2);
  expect(screen.getAllByTestId(/^donut-row-p\d$/)).toHaveLength(4);
  expect(text('donut-row-p1-value')).toBe('$0.00');
  expect(text('donut-row-p2-value')).toBe('$-1.00');
});

test('six donut parts fold into five rows and Other', () => {
  render(<Donut testID="donut" parts={parts([100, 100, 100, 100, 100, 250, 50])} total={800} money={money}
    centre={{ figure: '$8', label: '7 ways' }} />);
  expect(screen.getAllByTestId(/^donut-row-[a-z0-9]+$/).map(row => row.getAttribute('data-testid'))).toEqual([
    'donut-row-p0', 'donut-row-p1', 'donut-row-p2', 'donut-row-p3', 'donut-row-p4', 'donut-row-other',
  ]);
  expect(within(screen.getByTestId('donut-row-other')).getByText('Other')).not.toBeNull();
  expect(text('donut-row-other-value')).toBe('$3.00');
  expect(within(screen.getByTestId('donut-row-other')).getByText('37.5%')).not.toBeNull();
  expect(arcs('donut')).toBe(6);
});

test('exactly six donut parts fold the sixth into Other', () => {
  render(<Donut testID="donut" parts={parts([100, 100, 100, 100, 100, 250])} total={750} money={money}
    centre={{ figure: '$8', label: '6 ways' }} />);
  expect(screen.getAllByTestId(/^donut-row-[a-z0-9]+$/).map(row => row.getAttribute('data-testid'))).toEqual([
    'donut-row-p0', 'donut-row-p1', 'donut-row-p2', 'donut-row-p3', 'donut-row-p4', 'donut-row-other',
  ]);
  expect(text('donut-row-other-value')).toBe('$2.50');
});

// v2 reports/cards/donut.tsx:41-45 reads --color-c1..c5 for the ring.
test("the Donut rings its parts in v2's chart colours c1 to c5, the sixth part and on folded into Other on c5", () => {
  render(<Donut testID="donut" parts={parts([100, 100, 100, 100, 100, 100, 50])} total={650} money={money}
    centre={{ figure: '$7', label: '7 ways' }} />);
  const stroke = (key: string) => screen.getByTestId(`donut-arc-${key}`).getAttribute('stroke');
  expect(['p0', 'p1', 'p2', 'p3', 'p4', 'other'].map(stroke)).toEqual([
    'var(--color-c1)', 'var(--color-c2)', 'var(--color-c3)', 'var(--color-c4)', 'var(--color-c5)', 'var(--color-c5)',
  ]);
});

const C = 2 * Math.PI * 46;
const dashOffset = (testID: string) => Number(screen.getByTestId(testID).getAttribute('stroke-dashoffset'));

test('each arc starts where the positive parts before it end', () => {
  render(<Donut testID="donut" parts={parts([300, 100])} total={400} money={money} centre={{ figure: '$4', label: '2 ways' }} />);
  expect(dashOffset('donut-arc-p0')).toBe(0);
  expect(dashOffset('donut-arc-p1')).toBeCloseTo(-C * 300 / 400, 3);
  cleanup();
  // A part at or below zero before an arc does not shift it.
  render(<Donut testID="donut" parts={parts([300, -50, 100])} total={400} money={money} centre={{ figure: '$4', label: '3 ways' }} />);
  expect(dashOffset('donut-arc-p0')).toBe(0);
  expect(dashOffset('donut-arc-p2')).toBeCloseTo(-C * 300 / 400, 3);
});

test('Where sold shows one In store row with the total, and opens the Where sold table', () => {
  const onOpenTable = cards();
  expect(text('card-where-sold-figure')).toBe('$1576.40');
  expect(screen.getAllByTestId(/^card-where-sold-donut-row-[a-z]+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-where-sold-donut-row-store']);
  const row = within(screen.getByTestId('card-where-sold-donut-row-store'));
  expect(row.getByText('In store')).not.toBeNull();
  expect(row.getByText('12 orders')).not.toBeNull();
  expect(text('card-where-sold-donut-row-store-value')).toBe('$1576.40');
  expect(text('card-where-sold-donut-figure')).toBe('$1,576');
  expect(within(screen.getByTestId('card-where-sold-donut')).getByText('1 channel')).not.toBeNull();
  expect(within(screen.getByTestId('card-where-sold')).getByText('›')).not.toBeNull();
  fireEvent.click(screen.getByTestId('card-where-sold-open'));
  expect(onOpenTable).toHaveBeenCalledWith('where-sold');
  expect(onOpenTable).toHaveBeenCalledOnce();
});

test('Where sold reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-where-sold-empty')).toBe('No sales in this period');
});

test('the Top products card lists the four best sellers with amount, share bar and units sold', () => {
  cards({ products });
  expect(text('card-products-figure')).toBe('23');
  expect(screen.getAllByTestId(/^card-products-row-\d$/).map(row => row.getAttribute('data-testid'))).toEqual([
    'card-products-row-0', 'card-products-row-1', 'card-products-row-2', 'card-products-row-3',
  ]);
  expect(screen.queryByTestId('card-products-row-4')).toBeNull();
  const first = within(screen.getByTestId('card-products-row-0'));
  expect(first.getByText('Espresso')).not.toBeNull();
  expect(first.getByText('$591.15')).not.toBeNull();
  expect(first.getByText('37.5% · 10 sold')).not.toBeNull();
  const fourth = within(screen.getByTestId('card-products-row-3'));
  expect(fourth.getByText('Bagel')).not.toBeNull();
  expect(fourth.getByText('$157.64')).not.toBeNull();
  expect(fourth.getByText('10% · 2 sold')).not.toBeNull();
  expect((screen.getByTestId('card-products-row-0-bar').firstElementChild as HTMLElement).style.transform).toBe('translateX(-62.5%)');
  expect(screen.queryByTestId('card-products-open')).toBeNull();
});

test('a product with no name reads Unknown, and a tiny share still draws a sliver', () => {
  cards({ products: [{ key: 'x', productId: '', name: '', quantity: 1, amountMinor: 10 }] });
  expect(within(screen.getByTestId('card-products-row-0')).getByText('Unknown')).not.toBeNull();
  expect((screen.getByTestId('card-products-row-0-bar').firstElementChild as HTMLElement).style.transform).toBe('translateX(-98%)');
});

test('the Top products card reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-products-figure')).toBe('0');
  expect(text('card-products-empty')).toBe('No sales in this period');
  expect(screen.queryByTestId('card-products-row-0')).toBeNull();
});

test('the Categories card shows a donut row per category with amount, share and units sold', () => {
  cards({ categories });
  expect(text('card-categories-figure')).toBe(money(period.totalMinor));
  expect(text('card-categories-donut-figure')).toBe(moneyWhole(period.totalMinor));
  const donut = within(screen.getByTestId('card-categories-donut'));
  expect(donut.getByText('2 categories')).not.toBeNull();
  expect(donut.getAllByTestId(/^card-categories-donut-row-[a-z0-9]+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-categories-donut-row-10', 'card-categories-donut-row-20', 'card-categories-donut-row-uncategorised', 'card-categories-donut-row-unknown']);
  for (const [key, label, value, share, note] of [
    ['10', 'Coffee', '$788.20', '50%', '3 sold'],
    ['20', 'Bakery', '$394.10', '25%', '2 sold'],
    ['uncategorised', 'Uncategorised', '$197.05', '12.5%', '1 sold'],
    ['unknown', 'Unknown product', '$197.05', '12.5%', '1 sold'],
  ]) {
    const row = within(screen.getByTestId(`card-categories-donut-row-${key}`));
    for (const content of [label, value, share, note]) expect(row.getByText(content)).not.toBeNull();
  }
  expect(text('card-categories-unknown')).toBe('1 of 5 lines have no local product');
  expect(classesOf('card-categories-unknown')).toEqual(expect.arrayContaining(['text-sm', 'text-muted-foreground']));
  expect(screen.queryByTestId('card-categories-open')).toBeNull();
  expect(within(screen.getByTestId('card-categories')).queryByText('›')).toBeNull();
});

test('one real category reads 1 category, leaving out Uncategorised and Unknown product', () => {
  cards({ categories: { ...categories, parts: categories.parts.filter(row => row.key !== '20') } });
  expect(within(screen.getByTestId('card-categories-donut')).getByText('1 category')).not.toBeNull();
});

test('the Categories card reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-categories-empty')).toBe('No sales in this period');
  expect(screen.queryByTestId('card-categories-donut')).toBeNull();
  expect(screen.queryByTestId('card-categories-unknown')).toBeNull();
});

test('the Cashiers card shows a donut row per cashier with their name, amount, share and orders', () => {
  cards({ cashiers: [{ id: '7', name: 'Alex' }, { id: '9', name: 'Sam' }] });
  expect(text('card-cashiers-figure')).toBe('2');
  const donut = within(screen.getByTestId('card-cashiers-donut'));
  expect(donut.getAllByTestId(/^card-cashiers-donut-row-\d+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-cashiers-donut-row-7', 'card-cashiers-donut-row-9']);
  const alex = within(screen.getByTestId('card-cashiers-donut-row-7'));
  for (const label of ['Alex', '$985.25', '62.5%', '8 orders']) expect(alex.getByText(label)).not.toBeNull();
  const sam = within(screen.getByTestId('card-cashiers-donut-row-9'));
  for (const label of ['Sam', '$591.15', '37.5%', '4 orders']) expect(sam.getByText(label)).not.toBeNull();
  expect(text('card-cashiers-donut-figure')).toBe('$1,576');
  expect(donut.getByText('2 cashiers')).not.toBeNull();
  expect(screen.queryByTestId('card-cashiers-open')).toBeNull();
});

test('the Cashiers card names a cashier not on this device #id, and an order with none Unknown', () => {
  cards({ period: { ...period, totalMinor: 400, byCashier: [
    { cashierRef: '42', count: 1, totalMinor: 300 },
    { cashierRef: '', count: 1, totalMinor: 100 },
  ] } });
  expect(within(screen.getByTestId('card-cashiers-donut-row-42')).getByText('#42')).not.toBeNull();
  const unknown = within(screen.getByTestId('card-cashiers-donut-row-unknown'));
  expect(unknown.getByText('Unknown')).not.toBeNull();
  expect(unknown.getByText('1 order')).not.toBeNull();
});

test('one cashier reads 1 cashier', () => {
  cards({ period: { ...period, totalMinor: 300, byCashier: [{ cashierRef: '7', count: 1, totalMinor: 300 }] } });
  expect(within(screen.getByTestId('card-cashiers-donut')).getByText('1 cashier')).not.toBeNull();
  expect(text('card-cashiers-figure')).toBe('1');
});

test('the Cashiers card reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-cashiers-figure')).toBe('0');
  expect(text('card-cashiers-empty')).toBe('No sales in this period');
  expect(screen.queryByTestId('card-cashiers-donut')).toBeNull();
});

test('the Taxes card reads the tax collected, a legend per rate and Net / Tax / Gross, and opens the Taxes table', () => {
  const onOpenTable = cards({ period: { ...period, taxMinor: 196, taxRates: [
    { ratePpm: 13750, label: 'Tax 1.375%', netMinor: 1600, taxMinor: 22, grossMinor: 1622 },
    { ratePpm: 72500, label: 'Tax 7.25%', netMinor: 2400, taxMinor: 174, grossMinor: 2574 },
  ] } });
  expect(text('card-taxes-figure')).toBe('$1.96');
  expect(screen.getAllByTestId(/^card-taxes-rate-\d+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-taxes-rate-13750', 'card-taxes-rate-72500']);
  const row = within(screen.getByTestId('card-taxes-rate-72500'));
  expect(row.getByText('Tax 7.25%')).not.toBeNull();
  expect(row.getByText('$1.74')).not.toBeNull();
  expect(row.getByText('on $24.00')).not.toBeNull();
  expect(screen.getByTestId('card-taxes-bar').children).toHaveLength(2);
  expect(text('card-taxes-net')).toBe('$1574.44');
  expect(text('card-taxes-tax')).toBe('$1.96');
  expect(text('card-taxes-gross')).toBe('$1576.40');
  expect(within(screen.getByTestId('card-taxes')).getByText('›')).not.toBeNull();
  fireEvent.click(screen.getByTestId('card-taxes-open'));
  expect(onOpenTable).toHaveBeenCalledOnce();
  expect(onOpenTable).toHaveBeenCalledWith('taxes');
});

// v2 reports/cards/taxes.tsx:10: five shared hues, cycled, so a sixth rate takes the first again.
test('the taxes bar and legend cycle bg-c1 to bg-c5, a sixth rate taking bg-c1 again', () => {
  const rates = [10000, 20000, 30000, 40000, 50000, 60000];
  cards({ period: { ...period, taxMinor: 210, taxRates: rates.map((ratePpm, index) => (
    { ratePpm, label: `Tax ${index}`, netMinor: 1000, taxMinor: 10 * (index + 1), grossMinor: 1000 + 10 * (index + 1) })) } });
  const hues = ['bg-c1', 'bg-c2', 'bg-c3', 'bg-c4', 'bg-c5', 'bg-c1'];
  const hue = (testID: string) => classesOf(testID).filter(name => name.startsWith('bg-'));
  expect(rates.map(ratePpm => hue(`card-taxes-bar-${ratePpm}`))).toEqual(hues.map(name => [name]));
  expect(rates.map(ratePpm => hue(`card-taxes-rate-${ratePpm}-swatch`))).toEqual(hues.map(name => [name]));
});

test('the Taxes card reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-taxes-figure')).toBe('$0.00');
  expect(screen.queryAllByTestId(/^card-taxes-rate-/)).toHaveLength(0);
  expect(screen.getByTestId('card-taxes-bar').children).toHaveLength(1);
  expect(text('card-taxes-tax')).toBe('$0.00');
});

test('the Taxes bar draws only the rates that collected tax, and the legend lists every rate', () => {
  cards({ period: { ...period, taxMinor: 174, taxRates: [
    { ratePpm: 0, label: 'Zero rate', netMinor: 500, taxMinor: 0, grossMinor: 500 },
    { ratePpm: 72500, label: 'Tax 7.25%', netMinor: 2400, taxMinor: 174, grossMinor: 2574 },
  ] } });
  expect(screen.getByTestId('card-taxes-bar').children).toHaveLength(1);
  expect(screen.getAllByTestId(/^card-taxes-rate-\d+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-taxes-rate-0', 'card-taxes-rate-72500']);
  expect(within(screen.getByTestId('card-taxes-rate-0')).getByText('$0.00')).not.toBeNull();
});

const rows = () => screen.getAllByTestId(/^reports-period-row-\d$/).map(row =>
  Array.from(row.children).map(cell => cell.firstElementChild?.getAttribute('data-testid') ?? null));

test('the grid follows the measured width: three, two or one column', () => {
  cards();
  expect(rows()).toEqual([['card-orders'], ['card-payments'], ['card-where-sold'], ['card-products'], ['card-categories'], ['card-cashiers'], ['card-taxes']]);
  layout('reports-period-section', 1200);
  expect(rows()).toEqual([['card-orders', 'card-payments', 'card-where-sold'], ['card-products', 'card-categories', 'card-cashiers'], ['card-taxes', null, null]]);
  layout('reports-period-section', 700);
  expect(rows()).toEqual([['card-orders', 'card-payments'], ['card-where-sold', 'card-products'], ['card-categories', 'card-cashiers'], ['card-taxes', null]]);
  layout('reports-period-section', 400);
  expect(rows()).toEqual([['card-orders'], ['card-payments'], ['card-where-sold'], ['card-products'], ['card-categories'], ['card-cashiers'], ['card-taxes']]);
});

test('each card is v2\'s Card: the card fill on the page, its border and radius (cards/card.tsx:25)', () => {
  cards();
  for (const id of ['card-orders', 'card-payments', 'card-where-sold', 'card-products', 'card-categories', 'card-cashiers', 'card-taxes']) {
    expect(classesOf(id)).toEqual(expect.arrayContaining([...CARD_CLASSES, 'border-border', 'p-4']));
  }
});
