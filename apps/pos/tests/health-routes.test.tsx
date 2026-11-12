// The Store health area's routes: the sub-nav layout, its index and the old /logs link.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import HealthLayoutRoute from '../app/health/_layout';
import HealthIndex from '../app/health/index';
import LogsRedirect from '../app/logs';

const mocks = vi.hoisted(() => ({
  pathname: '/health/database',
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: vi.fn(() => false) },
}));

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

test('/health opens on Database', () => {
  render(<HealthIndex />);
  expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/health/database');
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

test('on a phone the area bar reads Store health, and Back with no history goes to the POS', () => {
  setWidth(400);
  render(<HealthLayoutRoute />);
  expect(screen.getByText('Store health')).not.toBeNull();
  fireEvent.click(screen.getByTestId('health-back'));
  expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith('/catalogue');
});
