// Store health › Performance: the status line and the Engine uptime strip over live request metrics.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { Text } from '@tallyui/components';
import { createRequestMetrics } from '@tallyui/database';
import { PerformanceScreen } from '../components/performance-screen';
import { classesOf } from './classes-of';

const nowMs = Date.UTC(2026, 10, 12, 15, 30);
const now = () => nowMs;

afterEach(() => { cleanup(); });

test('with no metrics the page reads Normal, no history, and 24 closed hours with the legend', () => {
  render(<PerformanceScreen metrics={createRequestMetrics({ now })} healthy now={now} />);
  expect(screen.getByTestId('performance-status').textContent).toBe('✓ Normal');
  expect(screen.getByTestId('performance-summary').textContent)
    .toBe('— no history yet. These numbers fill in as this till runs; the controls below work now.');
  const cells = screen.getAllByTestId('uptime-cell');
  expect(cells).toHaveLength(24);
  expect(cells.every(cell => cell.getAttribute('aria-label')?.endsWith('— app closed'))).toBe(true);
  for (const text of ['running', '⚠ errors that hour', 'app closed', 'now ▸', 'Engine uptime']) expect(screen.getByText(text)).not.toBeNull();
});

test('requests recorded while the page is open fill the summary and the current hour', () => {
  const metrics = createRequestMetrics({ now });
  render(<PerformanceScreen metrics={metrics} healthy now={now} />);
  act(() => {
    metrics.record({ atMs: nowMs - 60_000, durationMs: 100, bytes: 1_000, failed: false });
    metrics.record({ atMs: nowMs - 30_000, durationMs: 200, bytes: 1_000, failed: true });
    metrics.record({ atMs: nowMs, durationMs: 300, bytes: 1_000, failed: false });
  });
  expect(screen.getByTestId('performance-summary').textContent).toBe('— last 24 h: 3 requests · 0.0 MB · typical response 200 ms');
  const cells = screen.getAllByTestId('uptime-cell');
  expect(cells[23]!.getAttribute('aria-label')).toMatch(/— 3 requests · 1 failed$/);
});

test('an unhealthy till reads Needs attention', () => {
  render(<PerformanceScreen metrics={createRequestMetrics({ now })} healthy={false} now={now} />);
  expect(screen.getByTestId('performance-status').textContent).toBe('⚠ Needs attention');
  // v2 components/health/performance-screen.tsx:193.
  expect(classesOf('performance-status')).toContain('text-warning-text');
});

// v2 components/health/performance-screen.tsx:38 (DOCS_URL), :410-413, core.json "Learn more in the docs".
test("the foot links to v2's Performance docs", () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<PerformanceScreen metrics={createRequestMetrics({ now })} healthy now={now}>
    <Text testID="performance-child">sync</Text>
  </PerformanceScreen>);
  const link = screen.getByTestId('performance-docs-link');
  expect(link.textContent).toBe('Learn more in the docs');
  // The link is the page's foot, after the sync controls the route passes in.
  expect(screen.getByTestId('performance-child').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith('https://docs.wcpos.com/support/store-health#performance');
  open.mockRestore();
});
