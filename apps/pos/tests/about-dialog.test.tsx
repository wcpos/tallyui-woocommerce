import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { AppRail } from '../components/app-rail';
import { DrawerSheet } from '../components/drawer-content';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../lib/software';

afterEach(cleanup);

test("the rail's version opens the About dialog with the app version and the platform", () => {
  render(<><AppRail active="pos" onNavigate={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('about-dialog')).toBeNull();
  fireEvent.click(screen.getByTestId('drawer-version-button'));
  expect(screen.getByTestId('about-dialog-title').textContent).toBe(`About ${SOFTWARE_NAME}`);
  expect(screen.getByTestId('about-dialog-application').textContent).toContain('Application');
  expect(screen.getByTestId('about-dialog-app-version').textContent).toBe(`App Version${SOFTWARE_VERSION}`);
  expect(screen.getByTestId('about-dialog-platform').textContent).toBe('PlatformWeb');
});

test('the About dialog leaves out what this app has no data for', () => {
  render(<><AppRail active="pos" onNavigate={vi.fn()} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-version-button'));
  expect(screen.queryByText('Server')).toBeNull();
  expect(screen.queryByText('WordPress')).toBeNull();
  expect(screen.queryByText('License')).toBeNull();
  expect(screen.queryByText('Release notes')).toBeNull();
  expect(within(screen.getByTestId('about-dialog')).getAllByTestId(/^about-dialog-(app-version|platform)$/)).toHaveLength(2);
});

test('Close shuts the About dialog', () => {
  render(<><AppRail active="pos" onNavigate={vi.fn()} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-version-button'));
  fireEvent.click(screen.getByTestId('about-dialog-close'));
  expect(screen.queryByTestId('about-dialog')).toBeNull();
});

test("the phone drawer's version opens the About dialog over the drawer", () => {
  const onOpenChange = vi.fn();
  render(<><DrawerSheet open onOpenChange={onOpenChange} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-version-button'));
  expect(screen.queryByTestId('about-dialog')).not.toBeNull();
  expect(screen.queryByTestId('drawer-panel')).not.toBeNull();
  expect(screen.getByTestId('about-dialog-app-version').textContent).toBe(`App Version${SOFTWARE_VERSION}`);
  expect(onOpenChange).not.toHaveBeenCalled();
});
