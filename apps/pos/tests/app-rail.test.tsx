import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { AppFrame, AppRail } from '../components/app-rail';
import { RegisterBarShell } from '../components/register-bar-shell';
import { classesOf } from './classes-of';

afterEach(() => { cleanup(); });

const testIdsIn = (group: string) =>
  Array.from(screen.getByTestId(group).querySelectorAll('[role="button"]')).map(button => button.getAttribute('data-testid'));

const bar = <RegisterBarShell storeName="Corner Café" avatar={null} onOpenMenu={() => {}} />;

test('the rail lists POS, Products, Orders, Coupons, Customers and Reports, then Store health and Settings at the foot, then the version', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  expect(testIdsIn('drawer-top-group')).toEqual(['drawer-item-pos', 'drawer-item-products', 'drawer-item-orders', 'drawer-item-coupons', 'drawer-item-customers', 'drawer-item-reports']);
  expect(testIdsIn('drawer-bottom-group')).toEqual(['drawer-item-health', 'drawer-item-settings']);
  expect(screen.getByTestId('drawer-version').textContent).toBe('v 0.1.0');
  // Logs is a Store health page (v2), not a rail item.
  for (const id of ['drawer-item-support', 'drawer-item-logs']) expect(screen.queryByTestId(id)).toBeNull();
});

test('each rail item is an icon button named for its area', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const items = [['POS', 'drawer-item-pos'], ['Products', 'drawer-item-products'], ['Orders', 'drawer-item-orders'], ['Coupons', 'drawer-item-coupons'], ['Customers', 'drawer-item-customers'],
    ['Reports', 'drawer-item-reports'], ['Store health', 'drawer-item-health'], ['Settings', 'drawer-item-settings']];
  for (const [label, testID] of items) expect(screen.getByRole('button', { name: label }).getAttribute('data-testid')).toBe(testID);
});

test('Settings shows v2\'s gear (its tabler settings paths), not the old sliders', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const glyph = screen.getByTestId('drawer-item-settings').querySelector('[data-testid="drawer-glyph-settings"]')!;
  const paths = Array.from(glyph.querySelectorAll('path')).map(path => path.getAttribute('d')?.slice(0, 14));
  expect(paths).toEqual(['M10.325 4.317c', 'M9 12a3 3 0 1 ']);
  expect(glyph.querySelectorAll('line')).toHaveLength(0);
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

test("the rail draws v2's rail tokens: the rail and its border, rail-foreground items, the selected item on rail-selected", () => {
  render(<AppRail active="orders" onNavigate={() => {}} />);
  expect(classesOf('drawer-panel-permanent')).toEqual(expect.arrayContaining(['bg-rail', 'border-rail-border']));
  expect(classesOf('drawer-panel-permanent')).not.toContain('bg-muted');
  expect(classesOf('drawer-item-orders')).toEqual(expect.arrayContaining(['bg-rail-selected', 'text-rail-selected-foreground']));
  expect(classesOf('drawer-item-pos')).toContain('text-rail-foreground');
  expect(classesOf('drawer-item-pos')).not.toContain('bg-rail-selected');
});
