// Uniwind's runtime does not load under Vitest; the chart reads fixed colours.
vi.mock('uniwind', () => ({ useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { HourlyBars } from '../components/hourly-bars';
import type { HourBucket } from '../lib/reports/sales-room';
import { classesOf } from './classes-of';

afterEach(cleanup);

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const hours: HourBucket[] = ([
  { hour: 9, today: { count: 2, totalMinor: 1158 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 10, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 11, today: { count: 0, totalMinor: 0 }, yesterday: { count: 1, totalMinor: 400 } },
  { hour: 12, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 13, today: { count: 2, totalMinor: 1838 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 14, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 15, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 16, today: { count: 0, totalMinor: 0 }, yesterday: { count: 1, totalMinor: 600 } },
] satisfies Omit<HourBucket, 'minute'>[]).map(b => ({ ...b, minute: b.hour * 60 }));
const bucket = (hour: number, today: number, yesterday: number, minute = hour * 60): HourBucket => ({
  hour, minute, today: { count: today ? 1 : 0, totalMinor: today }, yesterday: { count: yesterday ? 1 : 0, totalMinor: yesterday },
});
const chart = (props: Partial<Parameters<typeof HourlyBars>[0]> = {}) =>
  render(<HourlyBars hours={hours} money={money} nowKey={23 * 60} view="hour" {...props} />);
const style = (testID: string) => getComputedStyle(screen.getByTestId(testID));
const points = (testID: string) => screen.getByTestId(testID).getAttribute('points');
const axis = () => screen.getAllByTestId(/^sales-hour-\d\d$/).map(column => column.lastElementChild?.textContent);
type LayoutNode = HTMLElement & { __reactLayoutHandler(event: { nativeEvent: { layout: { width: number } } }): void };
// RNW attaches onLayout to the node; jsdom has no ResizeObserver, so the test reports the size.
const layout = (width: number) =>
  act(() => (screen.getByTestId('sales-room-hours') as LayoutNode).__reactLayoutHandler({ nativeEvent: { layout: { width } } }));

test('one column per hour, in order', () => {
  chart();
  expect(screen.getAllByTestId(/^sales-hour-\d\d$/).map(column => column.getAttribute('data-testid'))).toEqual([
    'sales-hour-09', 'sales-hour-10', 'sales-hour-11', 'sales-hour-12',
    'sales-hour-13', 'sales-hour-14', 'sales-hour-15', 'sales-hour-16',
  ]);
});

test('both days share one scale', () => {
  chart();
  expect(style('sales-hour-13-today').height).toBe('100%');
  expect(style('sales-hour-09-today').height).toBe('63%');
  expect(style('sales-hour-10-today').height).toBe('0%');
  expect(screen.queryByTestId('sales-hour-16-yesterday')).toBeNull();
});

test("yesterday's peak sets the scale when it is higher", () => {
  chart({ hours: hours.map(b => b.hour === 16 ? { ...b, yesterday: { count: 1, totalMinor: 2400 } } : b) });
  expect(style('sales-hour-13-today').height).toBe('77%');
  expect(style('sales-hour-09-today').height).toBe('48%');
});

test('the peak label reads the busiest hour over its column', () => {
  chart();
  layout(800);
  const peak = screen.getByTestId('hero-chart-peak');
  expect(peak.textContent).toBe('$18.38 · 2 orders');
  // Hour 13 is the fifth of eight columns: its centre is 4.5 / 8 of 800.
  expect(parseFloat(style('hero-chart-peak').left) + parseFloat(style('hero-chart-peak').width) / 2).toBe(450);
  cleanup();
  chart({ hours: hours.map(b => b.hour === 9 ? { ...b, today: { count: 1, totalMinor: 1838 } } : b) });
  expect(screen.getByTestId('hero-chart-peak').textContent).toBe('$18.38 · 1 order');
});

test('the busiest bar is full and the others are faint', () => {
  chart();
  expect(style('sales-hour-13-today').opacity).toBe('1');
  expect(style('sales-hour-09-today').opacity).toBe('0.55');
  expect(style('sales-hour-10-today').opacity).toBe('0.55');
});

test('no peak label without a sale today', () => {
  chart({ hours: [bucket(11, 0, 400)] });
  expect(screen.queryByTestId('hero-chart-peak')).toBeNull();
});

test('the comparison is one dashed line through the column centres', () => {
  chart({ hours: [bucket(9, 1000, 400), bucket(10, 500, 0), bucket(11, 0, 600)] });
  const line = screen.getByTestId('hero-chart-comparison');
  expect(points('hero-chart-comparison')).toBe('0.5,60 1.5,100 2.5,40');
  expect(line.getAttribute('stroke-dasharray')).toBe('4 4');
  expect(line.getAttribute('stroke-width')).toBe('1.5');
  expect(line.closest('svg')?.getAttribute('viewBox')).toBe('0 0 3 100');
  expect(line.closest('svg')?.getAttribute('preserveAspectRatio')).toBe('none');
});

test('no comparison line when the comparison day is empty', () => {
  chart({ hours: [bucket(9, 1000, 0), bucket(10, 500, 0)] });
  expect(screen.queryByTestId('hero-chart-comparison')).toBeNull();
});

test('the axis labels every column up to 12 hours and every second one beyond', () => {
  chart();
  expect(axis()).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
  cleanup();
  chart({ hours: Array.from({ length: 24 }, (_, hour) => bucket(hour, 0, 0)) });
  expect(axis()).toEqual(Array.from({ length: 24 }, (_, hour) => hour % 2 ? '' : `${String(hour).padStart(2, '0')}:00`));
  cleanup();
  chart({ hours: Array.from({ length: 13 }, (_, i) => bucket(i + 6, 0, 0)) });
  expect(axis().filter(Boolean)).toEqual(['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00']);
});

test('each column describes itself', () => {
  chart();
  expect(screen.getByTestId('sales-hour-13').getAttribute('aria-label')).toBe('13:00 — today $18.38, 2 orders; yesterday $0.00');
  expect(screen.getByTestId('sales-hour-11').getAttribute('aria-label')).toBe('11:00 — today $0.00, 0 orders; yesterday $4.00');
});

test('the column labels name the comparison day', () => {
  chart({ comparisonName: 'last Tuesday' });
  expect(screen.getByTestId('sales-hour-11').getAttribute('aria-label')).toBe('11:00 — today $0.00, 0 orders; last Tuesday $4.00');
});

test('renders nothing without sales', () => {
  chart({ hours: [] });
  expect(screen.queryByTestId('sales-room-hours')).toBeNull();
});

const running = [bucket(9, 10, 5), bucket(10, 0, 10), bucket(11, 20, 25)];

test('Running total plots today up to the current hour only', () => {
  chart({ hours: running, view: 'run', nowKey: 600 });
  // Cumulative 10, 10 against the larger end, the comparison's 40.
  expect(points('hero-chart-run')).toBe('0.5,75 1.5,75');
  expect(screen.getByTestId('hero-chart-total').textContent).toBe(`${money(10)} now`);
});

test('the comparison running line is cumulative over every hour', () => {
  chart({ hours: running, view: 'run', nowKey: 600 });
  expect(points('hero-chart-comparison')).toBe('0.5,87.5 1.5,62.5 2.5,0');
  expect(screen.getByTestId('hero-chart-comparison').getAttribute('stroke-dasharray')).toBe('4 4');
  expect(screen.getByTestId('hero-chart-comparison-total').textContent).toBe(money(40));
});

test('Running total draws a faint area and no bars', () => {
  chart({ hours: running, view: 'run', nowKey: 23 * 60 });
  expect(screen.getByTestId('hero-chart-area').getAttribute('fill-opacity')).toBe('0.1');
  expect(screen.queryAllByTestId(/^sales-hour-\d\d-today$/)).toHaveLength(0);
  expect(screen.getAllByTestId(/^sales-hour-\d\d$/)).toHaveLength(3);
  expect(screen.queryByTestId('hero-chart-peak')).toBeNull();
  expect(screen.getByTestId('hero-chart-total').textContent).toBe(`${money(30)} now`);
});

test('Running total has no comparison figure without a comparison sale', () => {
  chart({ hours: [bucket(9, 10, 0)], view: 'run', nowKey: 540 });
  expect(screen.queryByTestId('hero-chart-comparison-total')).toBeNull();
  expect(screen.queryByTestId('hero-chart-comparison')).toBeNull();
});

test("a live day's future buckets draw the comparison's value, muted at full opacity", () => {
  chart({ hours: [bucket(9, 1000, 400), bucket(10, 0, 800), bucket(11, 0, 200)], nowKey: 9 * 60 + 30 });
  expect(style('sales-hour-10-future').height).toBe('80%');
  expect(style('sales-hour-10-future').opacity).toBe('1');
  expect(classesOf('sales-hour-10-future')).toContain('bg-muted');
  expect(classesOf('sales-hour-10-future')).not.toContain('bg-primary');
  expect(style('sales-hour-11-future').height).toBe('20%');
  expect(screen.queryByTestId('sales-hour-10-today')).toBeNull();
  expect(screen.queryByTestId('sales-hour-09-future')).toBeNull();
  cleanup();
  chart({ hours: [bucket(9, 1000, 400), bucket(10, 0, 800)], nowKey: 9 * 60 + 30, live: false });
  expect(screen.queryByTestId('sales-hour-10-future')).toBeNull();
});

test('no future bar without a comparison', () => {
  chart({ hours: [bucket(9, 1000, 0), bucket(10, 0, 0)], nowKey: 9 * 60 + 30 });
  expect(screen.queryByTestId('sales-hour-10-future')).toBeNull();
  expect(screen.queryByTestId('sales-hour-10-today')).toBeNull();
});

test('the peak is chosen among the buckets up to now', () => {
  chart({ hours: [bucket(9, 500, 0), bucket(10, 900, 300)], nowKey: 9 * 60 + 30 });
  expect(screen.getByTestId('hero-chart-peak').textContent).toBe('$5.00 · 1 order');
  expect(style('sales-hour-09-today').opacity).toBe('1');
});

test("the empty day draws 12 labelled columns; a half-hour step names each column's minute", () => {
  chart({ hours: Array.from({ length: 12 }, (_, i) => bucket(i * 2, 0, 0, i * 120)) });
  expect(screen.getByTestId('sales-room-hours')).not.toBeNull();
  expect(axis()).toEqual(Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`));
  cleanup();
  chart({ hours: [bucket(10, 100, 0, 600), bucket(10, 0, 0, 630)] });
  expect(screen.getAllByTestId(/^sales-hour-\d{4}$/).map(column => [column.getAttribute('data-testid'), column.lastElementChild?.textContent]))
    .toEqual([['sales-hour-1000', '10:00'], ['sales-hour-1030', '10:30']]);
});
