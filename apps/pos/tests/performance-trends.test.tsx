// Store health › Performance: v2's "Your server, over time" trends over live request metrics
// (v2 apps/main/components/health/performance-screen.tsx:346-408, trend-frame.tsx, core.json).
// Uniwind's runtime does not load under Vitest; the trend lines read fixed colours (as hourly-bars.test).
vi.mock('uniwind', () => ({ useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { createRequestMetrics } from '@tallyui/database';
import { PerformanceScreen } from '../components/performance-screen';

const nowMs = Date.UTC(2026, 10, 12, 15, 30);
const now = () => nowMs;
const H13 = Date.UTC(2026, 10, 12, 13);
const H14 = H13 + 3_600_000;
const H15 = H14 + 3_600_000;
const WAITING = 'Not enough data yet — this trend fills in as the till runs';

afterEach(() => { cleanup(); });

const request = (atMs: number) => ({ atMs, durationMs: 100, bytes: 1_000, failed: false });
function seeded() {
  const metrics = createRequestMetrics({ now });
  for (let i = 0; i < 2; i += 1) metrics.record(request(H13 + 600_000));
  for (let i = 0; i < 4; i += 1) metrics.record(request(H14 + 600_000));
  metrics.recordServerLoad(1.5, H13 + 1_200_000);
  metrics.recordServerLoad(3, H14 + 1_200_000);
  return metrics;
}
const points = (id: string) => screen.getByTestId(id).getAttribute('points');
const text = (id: string) => screen.getByTestId(id).textContent;
const follows = (a: string, b: string) =>
  Boolean(screen.getByTestId(a).compareDocumentPosition(screen.getByTestId(b)) & Node.DOCUMENT_POSITION_FOLLOWING);

test('"Your server, over time" reads v2\'s copy with Server load above POS requests, drawn from the buckets', () => {
  render(<PerformanceScreen metrics={seeded()} healthy now={now} />);
  const section = within(screen.getByTestId('server-over-time-section'));
  expect(section.getByText('Your server, over time')).not.toBeNull();
  expect(section.getByText('Server load is everything running on your server — not just the POS.')).not.toBeNull();
  expect(text('performance-trend-load-label')).toBe('Server load');
  expect(text('performance-trend-requests-label')).toBe('POS requests');
  expect(follows('performance-trend-load', 'performance-trend-requests')).toBe(true);
  expect(points('performance-trend-requests-line')).toBe('0,55 100,10');
  expect(points('performance-trend-load-line')).toBe('0,55 100,10');
  expect(points('performance-trend-requests-area')).toBe('0,100 0,55 100,10 100,100');
  expect(text('performance-trend-load-latest')).toBe('3.0');
  expect(text('performance-trend-requests-latest')).toBe('4');
  expect(screen.queryByTestId('performance-trend-load-unavailable')).toBeNull();
});

test('each trend draws one point per bucket in time order and redraws on a new emission', () => {
  const metrics = seeded();
  render(<PerformanceScreen metrics={metrics} healthy now={now} />);
  act(() => { metrics.record(request(H15)); });
  expect(points('performance-trend-requests-line')).toBe('0,55 50,10 100,77.5');
  expect(text('performance-trend-requests-latest')).toBe('1');
  act(() => { metrics.recordServerLoad(6, H15 + 60_000); });
  expect(points('performance-trend-load-line')).toBe('0,77.5 50,55 100,10');
  expect(text('performance-trend-load-latest')).toBe('6.0');
});

test('with no buckets both trends hold their frame and say there is not enough data yet', () => {
  render(<PerformanceScreen metrics={createRequestMetrics({ now })} healthy now={now} />);
  expect(screen.getByTestId('server-over-time-section')).not.toBeNull();
  expect(text('performance-trend-load-waiting')).toBe(WAITING);
  expect(text('performance-trend-requests-waiting')).toBe(WAITING);
  expect(text('performance-trend-load-latest')).toBe('—');
  expect(text('performance-trend-requests-latest')).toBe('—');
  expect(screen.queryByTestId('performance-trend-requests-line')).toBeNull();
  // v2 keeps the section and claims nothing about the load before the first request.
  expect(screen.queryByTestId('performance-trend-load-unavailable')).toBeNull();
});

test('one hour is not yet a trend, but its value is shown', () => {
  const metrics = createRequestMetrics({ now });
  metrics.record(request(H15));
  render(<PerformanceScreen metrics={metrics} healthy now={now} />);
  expect(text('performance-trend-requests-waiting')).toBe(WAITING);
  expect(screen.queryByTestId('performance-trend-requests-line')).toBeNull();
  expect(text('performance-trend-requests-latest')).toBe('1');
});

test('requests without a load sample read that the server does not report its load', () => {
  const metrics = createRequestMetrics({ now });
  for (let i = 0; i < 3; i += 1) metrics.record(request(H14));
  render(<PerformanceScreen metrics={metrics} healthy now={now} />);
  expect(text('performance-trend-load-unavailable'))
    .toBe("Your server doesn't report its load. Everything else on this page still works.");
  expect(screen.queryByTestId('performance-trend-load')).toBeNull();
  expect(text('performance-trend-requests-latest')).toBe('3');
});

test('no pace line is drawn, and the section sits after the sync controls and before the docs link', () => {
  render(<PerformanceScreen metrics={seeded()} healthy now={now}>
    <Text testID="performance-child">sync</Text>
  </PerformanceScreen>);
  expect(screen.queryByTestId('server-pace')).toBeNull();
  expect(follows('uptime-section', 'performance-child')).toBe(true);
  expect(follows('performance-child', 'server-over-time-section')).toBe(true);
  expect(follows('server-over-time-section', 'performance-docs-link')).toBe(true);
});
