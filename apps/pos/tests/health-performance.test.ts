// Store health › Performance logic, ported from v2 performance-logic.ts.
import { expect, test } from 'vitest';
import { REQUEST_METRICS_HOUR_MS, type RequestMetricsBucket } from '@tallyui/database';
import { deriveUptimeCells, formatCadence, performanceSummary, summarizeLast24h } from '../lib/health/performance';

const HOUR = REQUEST_METRICS_HOUR_MS;
const nowMs = Date.UTC(2026, 10, 12, 15, 30);
const currentHour = Date.UTC(2026, 10, 12, 15);

function bucket(hourStartMs: number, fields: Partial<RequestMetricsBucket> = {}): RequestMetricsBucket {
  return { hourStartMs, requests: 0, bytes: 0, durationTotalMs: 0, durationCount: 0, errors: 0, ...fields };
}

test('with no buckets there are 24 closed cells, an hour apart, the last at the current hour', () => {
  const cells = deriveUptimeCells([], nowMs);
  expect(cells).toHaveLength(24);
  expect(cells.every(cell => cell.state === 'closed' && cell.requests === 0 && cell.errors === 0)).toBe(true);
  expect(cells[23]!.hourStartMs).toBe(currentHour);
  cells.forEach((cell, i) => expect(cell.hourStartMs).toBe(currentHour - (23 - i) * HOUR));
});

test('a bucket with errors is an errors cell, one without is running, and one older than the window is left out', () => {
  const cells = deriveUptimeCells([
    bucket(currentHour - 30 * HOUR, { requests: 9 }),
    bucket(currentHour - 2 * HOUR, { requests: 2 }),
    bucket(currentHour, { requests: 3, errors: 1 }),
  ], nowMs);
  expect(cells[23]).toEqual({ hourStartMs: currentHour, state: 'errors', requests: 3, errors: 1 });
  expect(cells[21]).toEqual({ hourStartMs: currentHour - 2 * HOUR, state: 'running', requests: 2, errors: 0 });
  expect(cells.filter(cell => cell.state !== 'closed')).toHaveLength(2);
  expect(cells.some(cell => cell.hourStartMs === currentHour - 30 * HOUR)).toBe(false);
});

test('summarizeLast24h sums inside 24 h only, with the rounded mean response, or null with no durations', () => {
  const summary = summarizeLast24h([
    bucket(currentHour - 30 * HOUR, { requests: 50, bytes: 9_000_000, durationTotalMs: 50_000, durationCount: 50 }),
    bucket(currentHour - 3 * HOUR, { requests: 2, bytes: 1_048_576, durationTotalMs: 301, durationCount: 2 }),
    bucket(currentHour, { requests: 1, bytes: 524_288, durationTotalMs: 100, durationCount: 1 }),
  ], nowMs);
  expect(summary).toEqual({ requests: 3, megabytes: 1.5, typicalMs: 134 });
  expect(summarizeLast24h([bucket(currentHour, { requests: 1 })], nowMs)).toEqual({ requests: 1, megabytes: 0, typicalMs: null });
  expect(summarizeLast24h([], nowMs)).toEqual({ requests: 0, megabytes: 0, typicalMs: null });
});

test('performanceSummary reads v2 copy, drops the typical part when null, and has a no-history line', () => {
  expect(performanceSummary({ requests: 5, megabytes: 0.01, typicalMs: 200 })).toBe('— last 24 h: 5 requests · 0.0 MB · typical response 200 ms');
  expect(performanceSummary({ requests: 5, megabytes: 0.01, typicalMs: null })).toBe('— last 24 h: 5 requests · 0.0 MB');
  expect(performanceSummary({ requests: 0, megabytes: 0, typicalMs: null }))
    .toBe('— no history yet. These numbers fill in as this till runs; the controls below work now.');
});

test('formatCadence: null when not positive, whole seconds under 90 s (never 0), else whole minutes', () => {
  expect(formatCadence(0)).toBeNull();
  expect(formatCadence(NaN)).toBeNull();
  expect(formatCadence(400)).toEqual({ value: 1, unit: 's' });
  expect(formatCadence(59_600)).toEqual({ value: 60, unit: 's' });
  expect(formatCadence(75_000)).toEqual({ value: 75, unit: 's' });
  expect(formatCadence(90_000)).toEqual({ value: 2, unit: 'min' });
  expect(formatCadence(300_000)).toEqual({ value: 5, unit: 'min' });
});
