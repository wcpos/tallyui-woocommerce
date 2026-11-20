// v2 apps/main/components/health/trend-scale.test.ts, case for case.
import { describe, expect, it } from 'vitest';
import { nearestIndex, niceCeil, xTickValues, yTickValues } from '../lib/health/trend-scale';

const HOUR_MS = 60 * 60 * 1000;
const point = (hour: number, y = 1) => ({ x: hour * HOUR_MS, y });

describe('niceCeil', () => {
  it('snaps to the nearest 1/2/5 step above the value', () => {
    expect(niceCeil(0.7)).toBe(1);
    expect(niceCeil(1.4)).toBe(2);
    expect(niceCeil(3)).toBe(5);
    expect(niceCeil(13.997)).toBe(20);
    expect(niceCeil(1252)).toBe(2000);
    expect(niceCeil(5000)).toBe(5000);
  });

  it('never returns a zero or negative domain', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(Number.NaN)).toBe(1);
  });
});

describe('xTickValues', () => {
  it('uses every point when there are few', () => {
    const points = [point(1), point(2), point(3)];
    expect(xTickValues(points)).toEqual([HOUR_MS, 2 * HOUR_MS, 3 * HOUR_MS]);
  });

  it('spreads at most maxTicks across a long series, ends included', () => {
    const points = Array.from({ length: 24 }, (_, i) => point(i));
    const ticks = xTickValues(points, 4);
    expect(ticks).toHaveLength(4);
    expect(ticks[0]).toBe(points[0]!.x);
    expect(ticks.at(-1)).toBe(points[23]!.x);
    // Ticks come from real buckets, so every one is an exact hour boundary.
    for (const tick of ticks) expect(tick % HOUR_MS).toBe(0);
  });

  it('returns one endpoint when maxTicks is one', () => {
    const points = [point(1), point(2)];
    expect(xTickValues(points, 1)).toEqual([points[0]!.x]);
  });

  it('returns nothing for an empty series', () => {
    expect(xTickValues([])).toEqual([]);
  });
});

describe('yTickValues', () => {
  it('brackets a zero-based domain with a midpoint', () => {
    expect(yTickValues(2000)).toEqual([0, 1000, 2000]);
  });
});

describe('nearestIndex', () => {
  it('has nothing to point at in an empty series', () => {
    expect(nearestIndex([], 0.5)).toBe(-1);
  });

  it('a single point sits at the left edge and is always the nearest', () => {
    expect(nearestIndex([point(1)], 0.8)).toBe(0);
  });

  it('snaps to the nearest of evenly spread points, clamping outside the plot', () => {
    const points = [point(1), point(2), point(3)];
    expect(nearestIndex(points, 0)).toBe(0);
    expect(nearestIndex(points, 0.2)).toBe(0);
    expect(nearestIndex(points, 0.3)).toBe(1);
    expect(nearestIndex(points, 0.5)).toBe(1);
    expect(nearestIndex(points, 0.9)).toBe(2);
    expect(nearestIndex(points, 1.5)).toBe(2);
    expect(nearestIndex(points, -1)).toBe(0);
  });

  it('gives a tie to the earlier point', () => {
    expect(nearestIndex([point(1), point(2)], 0.5)).toBe(0);
  });
});
