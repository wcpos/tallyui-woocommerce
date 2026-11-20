import type { TrendPoint } from './performance';

/**
 * Axis scaffolding for the Store health trend charts — pure so the tick maths
 * is testable without loading Skia/Victory.
 * Ported from WCPOS v2 apps/main/components/health/trend-scale.ts.
 */

/** Round up to the nearest 1/2/5 × 10^n — the classic "nice" axis ceiling. */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Up to `maxTicks` x ticks, taken from the plotted points themselves — the
 * buckets are hour-aligned, so ticks land on real clock hours instead of the
 * arbitrary millisecond values a generic linear scale would pick.
 */
export function xTickValues(points: TrendPoint[], maxTicks = 4): number[] {
  if (points.length === 0) return [];
  if (maxTicks === 1) return [points[0]!.x];
  if (points.length <= maxTicks) return points.map(point => point.x);
  const step = (points.length - 1) / (maxTicks - 1);
  const ticks = new Set<number>();
  for (let i = 0; i < maxTicks; i += 1) {
    ticks.add(points[Math.round(i * step)]!.x);
  }
  return [...ticks];
}

/** Baseline, midpoint, ceiling — three clean y ticks over a zero-based domain. */
export function yTickValues(domainTop: number): number[] {
  return [0, domainTop / 2, domainTop];
}

/**
 * The index of the point nearest `fraction` of the way across the plot (0 the left edge, 1 the right, anything outside
 * clamped), where each point sits at its share of the first-to-last span; a single point or a zero span sits at 0. The
 * earlier point wins a tie, and an empty series gives -1. v2's crosshair snaps to the nearest bucket this way.
 */
export function nearestIndex(points: TrendPoint[], fraction: number): number {
  if (points.length === 0) return -1;
  const at = Math.min(1, Math.max(0, fraction));
  const first = points[0]!.x;
  const span = points.at(-1)!.x - first;
  let best = 0;
  let bestDistance = Infinity;
  points.forEach((point, i) => {
    const distance = Math.abs((span > 0 ? (point.x - first) / span : 0) - at);
    if (distance < bestDistance) [best, bestDistance] = [i, distance];
  });
  return best;
}
