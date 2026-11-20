// The Settings area's routes: the index opens on General when wide and on the page list on a phone (v2 `NavigationAreaIndex`).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import SettingsLayoutRoute from '../app/settings/_layout';
import SettingsIndex from '../app/settings/index';

const mocks = vi.hoisted(() => ({
  pathname: '/settings',
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
  mocks.pathname = '/settings';
  for (const fn of Object.values(mocks.router)) fn.mockClear();
  setWidth(900);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('/settings opens on General when wide', () => {
  render(<SettingsIndex />);
  expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/settings/general');
});

test('on a phone /settings shows the list and pressing a row pushes its page', () => {
  setWidth(390);
  render(<><SettingsLayoutRoute /><SettingsIndex /></>);
  expect(screen.queryByTestId('redirect')).toBeNull();
  expect(screen.getByTestId('screen-settings')).not.toBeNull();
  expect(within(screen.getByTestId('settings-nav-tax')).getByTestId('settings-nav-tax-chevron')).not.toBeNull();
  expect(screen.queryByTestId('settings-page')).toBeNull();
  expect(within(screen.getByTestId('screen-settings')).getByTestId('slot')).not.toBeNull();
  fireEvent.click(screen.getByTestId('settings-nav-tax'));
  expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith('/settings/tax');
});

test('on a phone a Settings leaf goes back to /settings', () => {
  setWidth(390);
  mocks.pathname = '/settings/theme';
  render(<SettingsLayoutRoute />);
  expect(screen.getByTestId('settings-back').textContent).toBe('Settings');
  expect(screen.getByTestId('settings-page-title').textContent).toBe('Theme');
  fireEvent.click(screen.getByTestId('settings-back'));
  expect(mocks.router.dismissTo).toHaveBeenCalledExactlyOnceWith('/settings');
  expect(mocks.router.back).not.toHaveBeenCalled();
  expect(mocks.router.replace).not.toHaveBeenCalled();
});
