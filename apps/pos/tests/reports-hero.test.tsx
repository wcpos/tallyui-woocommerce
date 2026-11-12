import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { ReportsHero, type HeroFigures } from '../components/reports-hero';

// react-native-web drops className from the DOM, so read it off the component that took the testID. The node keeps
// the fiber it was created with, which after an update can be the stale alternate: take the one holding its props.
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
/** The className of the nearest component above a DOM node that has one (for nodes without a testID). */
function nodeClasses(element: Element): string[] {
  const node = element as unknown as Record<string, unknown>;
  let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))!] as (Fiber & { type?: unknown }) | undefined;
  for (; fiber; fiber = fiber.return) {
    const { className } = fiber.memoizedProps ?? {};
    // Skip the DOM element itself: react-native-web gives it generated `css-view-…` classes.
    if (typeof fiber.type !== 'string' && typeof className === 'string') return className.split(/\s+/);
  }
  return [];
}

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const text = (testID: string) => screen.getByTestId(testID).textContent;
const tone = (testID: string) => classesOf(testID).find(name => /^text-(success|destructive|muted-foreground)$/.test(name));

function renderHero(today: HeroFigures, previous: HeroFigures, { comparisonLabel = 'vs yesterday', width = 900 } = {}) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  const onOpenOrders = vi.fn();
  render(<ReportsHero today={today} previous={previous} comparisonLabel={comparisonLabel} money={money} onOpenOrders={onOpenOrders} />);
  return { onOpenOrders };
}

const today: HeroFigures = { count: 3, totalMinor: 1500, averageMinor: 500, items: 4 };

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('with nothing to compare, every difference line reads — and says so', () => {
  renderHero(today, { count: 0, totalMinor: 0, averageMinor: 0, items: 0 });
  expect(text('hero-total')).toBe('$15.00');
  expect(text('hero-orders')).toBe('3');
  expect(text('hero-average')).toBe('$5.00');
  expect(text('hero-items')).toBe('4');
  for (const id of ['hero-delta', 'hero-orders-delta', 'hero-average-delta', 'hero-items-delta']) {
    expect(text(id)).toBe('—');
    expect(screen.getByTestId(id).getAttribute('aria-label')).toBe('No comparison');
    expect(tone(id)).toBe('text-muted-foreground');
  }
});

test('the total line is a signed percentage against the comparison, toned by its sign', () => {
  renderHero(today, { count: 2, totalMinor: 1200, averageMinor: 600, items: 4 });
  expect(text('hero-delta')).toBe('+25.0% vs yesterday');
  expect(tone('hero-delta')).toBe('text-success');
  expect(screen.getByTestId('hero-delta').getAttribute('aria-label')).toBeNull();
  cleanup();
  renderHero({ ...today, totalMinor: 900 }, { count: 2, totalMinor: 1200, averageMinor: 600, items: 4 });
  expect(text('hero-delta')).toBe('−25.0% vs yesterday');
  expect(tone('hero-delta')).toBe('text-destructive');
});

test('the percentage is rounded to its tenth before its sign and tone', () => {
  renderHero({ ...today, totalMinor: 100_001 }, { count: 2, totalMinor: 100_000, averageMinor: 600, items: 4 });
  expect(text('hero-delta')).toBe('±0% vs yesterday');
  expect(tone('hero-delta')).toBe('text-muted-foreground');
});

test('a comparison with orders but no money leaves the total line — and keeps the companions', () => {
  renderHero(today, { count: 1, totalMinor: 0, averageMinor: 0, items: 1 });
  expect(text('hero-delta')).toBe('—');
  expect(screen.getByTestId('hero-delta').getAttribute('aria-label')).toBe('No comparison');
  expect(text('hero-orders-delta')).toBe('+2');
  expect(text('hero-average-delta')).toBe('+$5.00');
  expect(text('hero-items-delta')).toBe('+3');
});

test('companions show signed differences: a gain, a money loss and no change', () => {
  renderHero({ count: 3, totalMinor: 900, averageMinor: 300, items: 5 }, { count: 1, totalMinor: 500, averageMinor: 500, items: 5 });
  expect(text('hero-orders-delta')).toBe('+2');
  expect(tone('hero-orders-delta')).toBe('text-success');
  expect(text('hero-average-delta')).toBe('−$2.00');
  expect(tone('hero-average-delta')).toBe('text-destructive');
  expect(text('hero-items-delta')).toBe('±0');
  expect(tone('hero-items-delta')).toBe('text-muted-foreground');
  expect(classesOf('hero-items-delta')).toEqual(expect.arrayContaining(['text-sm', 'font-semibold']));
});

test('the Orders companion opens the Orders table', () => {
  const { onOpenOrders } = renderHero(today, { count: 1, totalMinor: 500, averageMinor: 500, items: 1 });
  const orders = screen.getByTestId('sales-room-orders-open');
  expect(orders.getAttribute('aria-label')).toBe('Open Orders table');
  expect(orders.contains(screen.getByTestId('hero-orders'))).toBe(true);
  fireEvent.click(orders);
  expect(onOpenOrders).toHaveBeenCalledOnce();
});

test('the comparison label passes through to the total line', () => {
  renderHero(today, { count: 2, totalMinor: 1200, averageMinor: 600, items: 4 }, { comparisonLabel: 'vs last Tuesday' });
  expect(text('hero-delta')).toBe('+25.0% vs last Tuesday');
});

test('a wide window sets the figure beside its companions, a narrow one above them', () => {
  renderHero(today, { count: 0, totalMinor: 0, averageMinor: 0, items: 0 }, { width: 900 });
  const wideRow = screen.getByTestId('hero-figure').parentElement!;
  expect(screen.getByTestId('hero-companions').parentElement).toBe(wideRow);
  expect(nodeClasses(wideRow)).toContain('flex-row');
  expect(classesOf('hero-companions')).toContain('flex-1');
  cleanup();
  renderHero(today, { count: 0, totalMinor: 0, averageMinor: 0, items: 0 }, { width: 400 });
  const narrowRow = screen.getByTestId('hero-figure').parentElement!;
  expect(nodeClasses(narrowRow)).toEqual(['gap-5']);
  expect(classesOf('hero-companions')).not.toContain('flex-1');
  cleanup();
  renderHero(today, { count: 0, totalMinor: 0, averageMinor: 0, items: 0 }, { width: 600 });
  expect(nodeClasses(screen.getByTestId('hero-figure').parentElement!)).toContain('flex-row');
});

test('the compare chip and chart toggle share a row when wide; narrow, the chip sits alone above the toggle', () => {
  const show = (width: number) => {
    vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
    render(<ReportsHero today={today} previous={today} comparisonLabel="vs yesterday" money={money} onOpenOrders={() => {}}
      compareChip={<ReactNative.Text testID="chip">vs yesterday</ReactNative.Text>} toggle={<ReactNative.View testID="toggle" />} />);
  };
  show(900);
  expect(classesOf('hero-compare-row')).toEqual(expect.arrayContaining(['flex-row', 'justify-between']));
  expect(screen.getByTestId('chip').parentElement).toBe(screen.getByTestId('hero-compare-row'));
  expect(screen.getByTestId('toggle').parentElement).toBe(screen.getByTestId('hero-compare-row'));
  cleanup();
  show(400);
  expect(classesOf('hero-compare-row')).not.toContain('flex-row');
  expect(nodeClasses(screen.getByTestId('chip').parentElement!)).toEqual(['self-start']);
  expect(screen.getByTestId('toggle').parentElement).toBe(screen.getByTestId('hero-compare-row'));
});

test('the hero is v2\'s Card: the card fill on the page, its border and radius (hero/index.tsx:491)', () => {
  renderHero(today, today);
  expect(classesOf('reports-hero')).toEqual(expect.arrayContaining(['rounded-lg', 'border', 'border-border', 'bg-card', 'p-4']));
});
