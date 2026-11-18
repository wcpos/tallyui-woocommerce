import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { View } from 'react-native';
import { AppFrame, AppRail } from '../components/app-rail';
import { RegisterBarShell } from '../components/register-bar-shell';
import { classesOf } from './classes-of';
import { UnreadLogsCount } from '../lib/logs/unread-errors';

test("the rail's Store health glyph carries the unread-error badge on its shoulder", () => {
  const rail = (count: number) => <UnreadLogsCount.Provider value={count}>
    <AppRail active="pos" onNavigate={() => {}} />
  </UnreadLogsCount.Provider>;
  const { rerender } = render(rail(7));
  const badge = screen.getByTestId('drawer-badge-health');
  const shoulder = screen.getByTestId('drawer-badge-health-shoulder');
  expect(shoulder.contains(badge)).toBe(true);
  expect(screen.getByTestId('drawer-item-health').contains(shoulder)).toBe(true);
  expect(badge.textContent).toBe('7');
  expect(classesOf('drawer-badge-health-shoulder')).toEqual(expect.arrayContaining(['absolute', 'bottom-3/4', 'left-full']));
  expect(screen.getAllByTestId('drawer-badge-health')).toHaveLength(1);
  rerender(rail(0));
  expect(screen.queryByTestId('drawer-badge-health')).toBeNull();
});

afterEach(() => { cleanup(); });

const testIdsIn = (group: string) =>
  Array.from(screen.getByTestId(group).querySelectorAll('[role="button"]')).map(button => button.getAttribute('data-testid'));

const bar = <RegisterBarShell storeName="Corner Café" avatar={null} onOpenMenu={() => {}} />;

test('the rail lists POS, Products, Orders, Coupons, Customers and Reports, then Store health, Settings and Support at the foot, then the version', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  expect(testIdsIn('drawer-top-group')).toEqual(['drawer-item-pos', 'drawer-item-products', 'drawer-item-orders', 'drawer-item-coupons', 'drawer-item-customers', 'drawer-item-reports']);
  expect(testIdsIn('drawer-bottom-group')).toEqual(['drawer-item-health', 'drawer-item-settings', 'drawer-item-support']);
  expect(screen.getByTestId('drawer-version').textContent).toBe('v 0.1.0');
  // Logs is a Store health page (v2), not a rail item.
  expect(screen.queryByTestId('drawer-item-logs')).toBeNull();
});

test('each rail item is an icon button named for its area', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const items = [['POS', 'drawer-item-pos'], ['Products', 'drawer-item-products'], ['Orders', 'drawer-item-orders'], ['Coupons', 'drawer-item-coupons'], ['Customers', 'drawer-item-customers'],
    ['Reports', 'drawer-item-reports'], ['Store health', 'drawer-item-health'], ['Settings', 'drawer-item-settings'], ['Support', 'drawer-item-support']];
  for (const [label, testID] of items) expect(screen.getByRole('button', { name: label }).getAttribute('data-testid')).toBe(testID);
});

test('Settings shows v2\'s gear (its tabler settings paths), not the old sliders', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const glyph = screen.getByTestId('drawer-item-settings').querySelector('[data-testid="drawer-glyph-settings"]')!;
  const paths = Array.from(glyph.querySelectorAll('path')).map(path => path.getAttribute('d')?.slice(0, 14));
  expect(paths).toEqual(['M10.325 4.317c', 'M9 12a3 3 0 1 ']);
  expect(glyph.querySelectorAll('line')).toHaveLength(0);
});

test('Support shows v2\'s support glyph, tabler message-question', () => {
  render(<AppRail active="pos" onNavigate={() => {}} />);
  const glyph = screen.getByTestId('drawer-item-support').querySelector('[data-testid="drawer-glyph-support"]')!;
  expect(Array.from(glyph.querySelectorAll('path')).map(path => path.getAttribute('d')?.slice(0, 12))).toEqual(['M8 9h8m-8 4h']);
});

test('Support navigates to its area from the rail', () => {
  const onNavigate = vi.fn();
  render(<AppRail active="settings" onNavigate={onNavigate} />);
  fireEvent.click(screen.getByTestId('drawer-item-support'));
  expect(onNavigate).toHaveBeenCalledWith('support');
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

// v2 pressable-surface/index.tsx:29 (WASH.rail) and nav-item/index.tsx:69.
test('a rail item washes in rail-accent on hover and press; the selected one keeps rail-selected', () => {
  render(<AppRail active="orders" onNavigate={() => {}} />);
  expect(classesOf('drawer-item-pos')).toEqual(expect.arrayContaining(['web:hover:bg-rail-accent', 'active:bg-rail-accent']));
  expect(classesOf('drawer-item-pos')).not.toContain('active:bg-accent');
  expect(classesOf('drawer-item-orders')).toEqual(expect.arrayContaining(['web:hover:bg-rail-selected', 'active:bg-rail-selected']));
  expect(classesOf('drawer-item-orders')).not.toContain('web:hover:bg-rail-accent');
});
