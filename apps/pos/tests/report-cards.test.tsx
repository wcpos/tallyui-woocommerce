// Uniwind's runtime does not load under Vitest (theme-settings.test mocks it too); the ring reads fixed colours.
vi.mock('uniwind', () => ({ useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Donut, ReportCards, type DonutPart } from '../components/report-cards';
import type { Period } from '../lib/reports/sales-room';

afterEach(cleanup);

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const moneyWhole = (minor: number) => `$${Math.round(minor / 100).toLocaleString('en-US')}`;
const empty: Period = {
  count: 0, totalMinor: 0, taxMinor: 0, averageMinor: 0, items: 0, medianMinor: 0, largestMinor: null, discountMinor: 0,
  pending: 0, rejected: 0, splitCount: 0, byMethod: [], taxRates: [],
};
const period: Period = {
  ...empty, count: 12, totalMinor: 157640, averageMinor: 13137, items: 23, medianMinor: 9850, largestMinor: 41000,
  discountMinor: 1250, splitCount: 0,
  byMethod: [
    { method: 'cash', label: 'Cash', count: 7, totalMinor: 98525 },
    { method: 'external', label: 'Card terminal', count: 5, totalMinor: 59115 },
  ],
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
  expect(text('card-orders-empty')).toBe('No orders in this period.');
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
  expect(text('card-payments-empty')).toBe('No payments in this period.');
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

test('Where sold shows one In store row with the total and no open button', () => {
  cards();
  expect(text('card-where-sold-figure')).toBe('$1576.40');
  expect(screen.queryByTestId('card-where-sold-open')).toBeNull();
  expect(screen.getAllByTestId(/^card-where-sold-donut-row-[a-z]+$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['card-where-sold-donut-row-store']);
  const row = within(screen.getByTestId('card-where-sold-donut-row-store'));
  expect(row.getByText('In store')).not.toBeNull();
  expect(row.getByText('12 orders')).not.toBeNull();
  expect(text('card-where-sold-donut-row-store-value')).toBe('$1576.40');
  expect(text('card-where-sold-donut-figure')).toBe('$1,576');
  expect(within(screen.getByTestId('card-where-sold-donut')).getByText('1 channel')).not.toBeNull();
});

test('Where sold reads an empty period', () => {
  cards({ period: empty });
  expect(text('card-where-sold-empty')).toBe('No sales in this period.');
});

const rows = () => screen.getAllByTestId(/^reports-period-row-\d$/).map(row =>
  Array.from(row.children).map(cell => cell.firstElementChild?.getAttribute('data-testid') ?? null));

test('the grid follows the measured width: three, two or one column', () => {
  cards();
  expect(rows()).toEqual([['card-orders'], ['card-payments'], ['card-where-sold']]);
  layout('reports-period-section', 1200);
  expect(rows()).toEqual([['card-orders', 'card-payments', 'card-where-sold']]);
  layout('reports-period-section', 700);
  expect(rows()).toEqual([['card-orders', 'card-payments'], ['card-where-sold', null]]);
  layout('reports-period-section', 400);
  expect(rows()).toEqual([['card-orders'], ['card-payments'], ['card-where-sold']]);
});
