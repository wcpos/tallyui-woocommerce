import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { AppFrame, AppRail } from '../components/app-rail';
import { RegisterBarShell } from '../components/register-bar-shell';

afterEach(() => { cleanup(); });

const testIdsIn = (group: string) =>
  Array.from(screen.getByTestId(group).querySelectorAll('[role="button"]')).map(button => button.getAttribute('data-testid'));

const bar = <RegisterBarShell storeName="Corner Café" avatar={null} onOpenMenu={() => {}} />;

test('the rail lists POS, Orders, Coupons, Customers and Reports, then Store health, Logs and Settings at the foot, then the version', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  expect(testIdsIn('drawer-top-group')).toEqual(['drawer-item-pos', 'drawer-item-orders', 'drawer-item-coupons', 'drawer-item-customers', 'drawer-item-reports']);
  expect(testIdsIn('drawer-bottom-group')).toEqual(['drawer-item-health', 'drawer-item-logs', 'drawer-item-settings']);
  expect(screen.getByTestId('drawer-version').textContent).toBe('v 0.1.0');
  for (const id of ['drawer-item-products', 'drawer-item-support']) expect(screen.queryByTestId(id)).toBeNull();
});

test('each rail item is an icon button named for its area', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const items = [['POS', 'drawer-item-pos'], ['Orders', 'drawer-item-orders'], ['Coupons', 'drawer-item-coupons'], ['Customers', 'drawer-item-customers'],
    ['Reports', 'drawer-item-reports'], ['Store health', 'drawer-item-health'], ['Logs', 'drawer-item-logs'], ['Settings', 'drawer-item-settings']];
  for (const [label, testID] of items) expect(screen.getByRole('button', { name: label }).getAttribute('data-testid')).toBe(testID);
});

test('the active item is selected and pressing it does nothing; another item navigates to its area', () => {
  const onNavigate = vi.fn();
  render(<AppRail active="orders" onNavigate={onNavigate} />);
  expect(screen.getByTestId('drawer-item-orders').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('drawer-item-pos').getAttribute('aria-selected')).not.toBe('true');
  fireEvent.click(screen.getByTestId('drawer-item-orders'));
  expect(onNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('drawer-item-customers'));
  expect(onNavigate).toHaveBeenCalledOnce();
  expect(onNavigate).toHaveBeenCalledWith('customers');
});

test('AppFrame draws the rail beside a wide area screen, and the register bar there has no menu', () => {
  render(<AppFrame wide pathname="/catalogue" onNavigate={() => {}}>{bar}</AppFrame>);
  expect(screen.queryByTestId('drawer-panel-permanent')).not.toBeNull();
  expect(screen.getByTestId('drawer-item-pos').getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByTestId('pos-drawer-open-button')).toBeNull();
  expect(screen.queryByTestId('register-bar-place')).not.toBeNull();
});

test.each([[false, '/catalogue'], [true, '/connect'], [true, '/']] as const)(
  'AppFrame draws no rail on a phone window or outside the areas, and the bar keeps its menu (wide %s, %s)', (wide, pathname) => {
    render(<AppFrame wide={wide} pathname={pathname} onNavigate={() => {}}>{bar}</AppFrame>);
    expect(screen.queryByTestId('drawer-panel-permanent')).toBeNull();
    expect(screen.queryByTestId('pos-drawer-open-button')).not.toBeNull();
  });

test('AppFrame hands onNavigate the current area and the pressed one', () => {
  const onNavigate = vi.fn();
  render(<AppFrame wide pathname="/settings/theme" onNavigate={onNavigate}><View /></AppFrame>);
  fireEvent.click(screen.getByTestId('drawer-item-orders'));
  expect(onNavigate).toHaveBeenCalledOnce();
  expect(onNavigate).toHaveBeenCalledWith('settings', 'orders');
});
