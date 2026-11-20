// The Store health area's routes: the sub-nav layout, its index and the old /logs link.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import HealthLayoutRoute from '../app/health/_layout';
import HealthIndex from '../app/health/index';
import LogsRedirect from '../app/logs';
import { UnreadLogsCount } from '../lib/logs/unread-errors';

const mocks = vi.hoisted(() => ({
  pathname: '/health/database',
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), dismissTo: vi.fn(), canGoBack: vi.fn(() => false) },
}));

vi.mock('../components/session-hold-banner', () => ({ SessionHoldBanner: () => null }));
vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <span data-testid="redirect" data-href={href} />,
  Slot: () => <span data-testid="slot" />,
  usePathname: () => mocks.pathname,
  useRouter: () => mocks.router,
}));

function setWidth(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => {
  mocks.pathname = '/health/database';
  for (const fn of Object.values(mocks.router)) fn.mockClear();
  setWidth(900);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('the Logs row shows the unread error count on the wide sub-rail, after its label', () => {
  render(<UnreadLogsCount.Provider value={3}><HealthLayoutRoute /></UnreadLogsCount.Provider>);
  expect(within(screen.getByTestId('health-nav-logs')).getByTestId('health-nav-logs-badge').textContent).toBe('3');
  for (const id of ['health-nav-database', 'health-nav-performance']) {
    const container = screen.getByTestId(id);
    expect(container.querySelector('[data-testid$="-badge"]')).toBeNull();
  }
  expect(screen.getByTestId('health-nav-logs').textContent).toBe('Logs3');
});

test('on a phone the Logs row shows the badge before its chevron, and none at zero', () => {
  setWidth(400);
  mocks.pathname = '/health';
  render(<UnreadLogsCount.Provider value={120}><HealthLayoutRoute /><HealthIndex /></UnreadLogsCount.Provider>);
  const badge = screen.getByTestId('health-nav-logs-badge');
  const chevron = screen.getByTestId('health-nav-logs-chevron');
  expect(badge.textContent).toBe('99+');
  expect(badge.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  cleanup();
  render(<UnreadLogsCount.Provider value={0}><HealthLayoutRoute /><HealthIndex /></UnreadLogsCount.Provider>);
  expect(screen.queryByTestId('health-nav-logs-badge')).toBeNull();
});

test('/health opens on Database when wide', () => {
  render(<HealthIndex />);
  expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/health/database');
});

test('on a phone /health shows the list, each row with a chevron, and no page card', () => {
  setWidth(400);
  mocks.pathname = '/health';
  render(<><HealthLayoutRoute /><HealthIndex /></>);
  expect(screen.queryByTestId('redirect')).toBeNull();
  expect(screen.getByTestId('screen-health')).not.toBeNull();
  expect(screen.getAllByTestId(/^health-nav-[a-z]+$/).map(el => [el.textContent, !!within(el).queryByTestId(`${el.getAttribute('data-testid')}-chevron`)]))
    .toEqual([['Database', true], ['Performance', true], ['Logs', true]]);
  expect(screen.queryByTestId('health-page')).toBeNull();
  // The Slot stays mounted on the index: without it expo-router loops (React #185) entering /health.
  expect(within(screen.getByTestId('screen-health')).getByTestId('slot')).not.toBeNull();
  fireEvent.click(screen.getByTestId('health-nav-logs'));
  expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith('/health/logs');
});

test('the old /logs link lands on /health/logs', () => {
  render(<LogsRedirect />);
  expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/health/logs');
});

test('the sub-nav lists Database, Performance then Logs, selects the open page, and titles the page by it', () => {
  mocks.pathname = '/health/logs';
  render(<HealthLayoutRoute />);
  expect(screen.getAllByTestId(/^health-nav-/).map(el => [el.getAttribute('data-testid'), el.textContent]))
    .toEqual([['health-nav-database', 'Database'], ['health-nav-performance', 'Performance'], ['health-nav-logs', 'Logs']]);
  expect(screen.getByTestId('health-nav-logs').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('health-nav-database').getAttribute('aria-selected')).not.toBe('true');
  expect(screen.getByTestId('health-page-title').textContent).toBe('Logs');
  expect(screen.getByTestId('slot')).not.toBeNull();
  fireEvent.click(screen.getByTestId('health-nav-database'));
  expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith('/health/database');
});

test('Database has its page description and Logs has none', () => {
  const { rerender } = render(<HealthLayoutRoute />);
  expect(screen.getByTestId('health-page-description').textContent).toBe('Your store, on this device — sales keep working even if your server does not.');
  mocks.pathname = '/health/logs';
  rerender(<HealthLayoutRoute />);
  expect(screen.queryByTestId('health-page-description')).toBeNull();
});

test('Performance has no page description', () => {
  mocks.pathname = '/health/performance';
  render(<HealthLayoutRoute />);
  expect(screen.getByTestId('health-page-title').textContent).toBe('Performance');
  expect(screen.queryByTestId('health-page-description')).toBeNull();
});

test("on a phone a leaf page's back reads Store health and goes to /health", () => {
  setWidth(400);
  mocks.pathname = '/health/logs';
  render(<HealthLayoutRoute />);
  expect(screen.getByTestId('health-back').textContent).toBe('Store health');
  expect(screen.getAllByText('Store health')).toHaveLength(1);
  expect(screen.queryAllByTestId(/^health-nav-/)).toHaveLength(0);
  expect(screen.getByTestId('health-page-title').textContent).toBe('Logs');
  fireEvent.click(screen.getByTestId('health-back'));
  expect(mocks.router.dismissTo).toHaveBeenCalledExactlyOnceWith('/health');
  expect(mocks.router.replace).not.toHaveBeenCalled();
  expect(mocks.router.back).not.toHaveBeenCalled();
});

test('on the phone index the bar is Menu and Store health, with no Back', () => {
  setWidth(400);
  mocks.pathname = '/health';
  render(<HealthLayoutRoute />);
  expect(screen.getByTestId('health-menu').getAttribute('aria-label')).toBe('Menu');
  expect(screen.getByText('Store health')).not.toBeNull();
  expect(screen.queryByTestId('health-back')).toBeNull();
});
