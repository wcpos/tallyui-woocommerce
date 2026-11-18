import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { DrawerSheet } from '../components/drawer-content';
import { AppRail } from '../components/app-rail';
import { RAIL_FOOT, RAIL_LABEL, RAIL_TOP } from '../lib/layout/rail-routes';
import { SOFTWARE_VERSION } from '../lib/software';
import { classesOf } from './classes-of';
import { UnreadLogsCount } from '../lib/logs/unread-errors';

afterEach(() => { cleanup(); });

const itemIds = () => screen.getAllByTestId(/^drawer-item-/).map(el => el.getAttribute('data-testid'));

test("the drawer lists every area the rail lists, in rail order, each with the rail's glyph", () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenProducts={vi.fn()} onOpenOrders={vi.fn()} onOpenCoupons={vi.fn()}
    onOpenCustomers={vi.fn()} onOpenReports={vi.fn()} onOpenHealth={vi.fn()} onOpenSettings={vi.fn()} /><PortalHost /></>);
  const keys = [...RAIL_TOP, ...RAIL_FOOT];
  const drawerIds = itemIds();
  expect(drawerIds).toEqual(keys.map(key => `drawer-item-${key}`));
  expect(screen.getAllByTestId(/^drawer-label-/).map(el => el.textContent)).toEqual(keys.map(key => RAIL_LABEL[key]));
  const glyphs = keys.map(key => {
    const item = within(screen.getByTestId(`drawer-item-${key}`));
    expect(item.getAllByTestId(/^drawer-glyph-/)).toHaveLength(1);
    return item.getByTestId(`drawer-glyph-${key}`).innerHTML;
  });
  const top = within(screen.getByTestId('drawer-top-group'));
  expect(top.getByTestId('drawer-item-products')).not.toBeNull();
  expect(top.getByTestId('drawer-item-coupons')).not.toBeNull();
  expect(within(screen.getByTestId('drawer-bottom-group')).getAllByTestId(/^drawer-item-/)[0].getAttribute('data-testid')).toBe('drawer-item-health');
  cleanup();
  render(<AppRail active="orders" onNavigate={vi.fn()} />);
  expect(itemIds()).toEqual(drawerIds);
  keys.forEach((key, index) => expect(screen.getByTestId(`drawer-glyph-${key}`).innerHTML).toBe(glyphs[index]));
});

test('each item draws its glyph before its label', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenProducts={vi.fn()} onOpenOrders={vi.fn()} onOpenCoupons={vi.fn()}
    onOpenCustomers={vi.fn()} onOpenReports={vi.fn()} onOpenHealth={vi.fn()} onOpenSettings={vi.fn()} /><PortalHost /></>);
  for (const key of [...RAIL_TOP, ...RAIL_FOOT]) {
    const item = within(screen.getByTestId(`drawer-item-${key}`));
    const glyph = item.getAllByTestId(/^drawer-glyph-/)[0];
    expect(glyph.compareDocumentPosition(item.getByTestId(`drawer-label-${key}`)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

test('Products and Coupons close the drawer, then open their areas', () => {
  const calls: string[] = [];
  const drawer = <><DrawerSheet open onOpenChange={open => calls.push(`open:${open}`)}
    onOpenProducts={() => calls.push('products')} onOpenCoupons={() => calls.push('coupons')} /><PortalHost /></>;
  render(drawer);
  fireEvent.click(screen.getByTestId('drawer-item-products'));
  expect(calls).toEqual(['open:false', 'products']);
  cleanup();
  calls.length = 0;
  render(drawer);
  fireEvent.click(screen.getByTestId('drawer-item-coupons'));
  expect(calls).toEqual(['open:false', 'coupons']);
});

test('the drawer lists the areas in v2 order with Store health starting the bottom group, then the version', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} onOpenCustomers={vi.fn()} onOpenReports={vi.fn()}
    onOpenHealth={vi.fn()} onOpenSettings={vi.fn()} /><PortalHost /></>);
  expect(itemIds()).toEqual(['drawer-item-pos', 'drawer-item-orders', 'drawer-item-customers', 'drawer-item-reports', 'drawer-item-health', 'drawer-item-settings']);
  expect(screen.getAllByTestId(/^drawer-item-/).map(el => el.textContent)).toEqual(['POS', 'Orders', 'Customers', 'Reports', 'Store health', 'Settings']);
  expect(within(screen.getByTestId('drawer-top-group')).queryByTestId('drawer-item-health')).toBeNull();
  expect(within(screen.getByTestId('drawer-bottom-group')).getAllByTestId(/^drawer-item-/)[0].getAttribute('data-testid')).toBe('drawer-item-health');
  expect(screen.getByTestId('drawer-version').textContent).toBe(`Version ${SOFTWARE_VERSION}`);
});

test('an item closes the drawer, then opens its area', () => {
  const calls: string[] = [];
  render(<><DrawerSheet open onOpenChange={open => calls.push(`open:${open}`)} onOpenReports={() => calls.push('reports')} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-item-reports'));
  expect(calls).toEqual(['open:false', 'reports']);
});

test('POS is the current area: it only closes the drawer', () => {
  const calls: string[] = [];
  render(<><DrawerSheet open onOpenChange={open => calls.push(`open:${open}`)}
    onOpenOrders={() => calls.push('orders')} onOpenCustomers={() => calls.push('customers')} onOpenReports={() => calls.push('reports')}
    onOpenHealth={() => calls.push('health')} onOpenSettings={() => calls.push('settings')} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-item-pos'));
  expect(calls).toEqual(['open:false']);
});

test('there is no Logs item, as in v2 (Logs is a Store health page), and Store health opens its area', () => {
  const onOpenHealth = vi.fn();
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenHealth={onOpenHealth} onOpenSettings={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('drawer-item-logs')).toBeNull();
  expect(screen.queryByText('Logs')).toBeNull();
  fireEvent.click(screen.getByTestId('drawer-item-health'));
  expect(onOpenHealth).toHaveBeenCalledOnce();
});

test('an area without a handler has no item', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(itemIds()).toEqual(['drawer-item-pos', 'drawer-item-orders']);
});

test('a closed drawer renders nothing', () => {
  render(<><DrawerSheet open={false} onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
});

// P13-S6: v2's phone drawer on the window rail's surface (_layout.tsx:84-107) and NavItem's drawer classes (nav-item/index.tsx:54-71).
test('the drawer draws in the rail tokens, the selected item on rail-selected', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(classesOf('drawer-panel')).toEqual(expect.arrayContaining(['bg-rail', 'border-rail-border']));
  expect(classesOf('drawer-item-orders')).toEqual(expect.arrayContaining(['h-12', 'rounded-lg', 'px-3']));
  expect(classesOf('drawer-item-orders')).not.toContain('bg-rail-selected');
  expect(classesOf('drawer-label-orders')).toContain('text-rail-foreground');
  expect(classesOf('drawer-item-pos')).toContain('bg-rail-selected');
  expect(classesOf('drawer-item-pos')).not.toContain('bg-accent');
  expect(classesOf('drawer-label-pos')).toContain('text-rail-selected-foreground');
});

// v2 pressable-surface/index.tsx:29 (WASH.rail) and nav-item/index.tsx:69.
test('a drawer item washes in rail-accent on hover and press; the selected one keeps rail-selected', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(classesOf('drawer-item-orders')).toEqual(expect.arrayContaining(['web:hover:bg-rail-accent', 'active:bg-rail-accent']));
  expect(classesOf('drawer-item-orders')).not.toContain('active:bg-accent');
  expect(classesOf('drawer-item-pos')).toEqual(expect.arrayContaining(['web:hover:bg-rail-selected', 'active:bg-rail-selected']));
  expect(classesOf('drawer-item-pos')).not.toContain('web:hover:bg-rail-accent');
});

test('Store health carries the unread-error badge after its label, 99+ past 99, none at 0', () => {
  const drawer = (count: number) => <><UnreadLogsCount.Provider value={count}>
    <DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} onOpenCustomers={vi.fn()} onOpenReports={vi.fn()}
      onOpenHealth={vi.fn()} onOpenSettings={vi.fn()} />
  </UnreadLogsCount.Provider><PortalHost /></>;
  const { rerender } = render(drawer(3));
  const badge = screen.getByTestId('drawer-badge-health');
  expect(within(screen.getByTestId('drawer-item-health')).getByTestId('drawer-badge-health')).toBe(badge);
  expect(badge.textContent).toBe('3');
  expect(classesOf('drawer-badge-health')).toEqual(expect.arrayContaining(['bg-destructive', 'h-4', 'rounded-full']));
  expect(screen.getByTestId('drawer-label-health').textContent).toBe('Store health');
  expect(screen.getByTestId('drawer-label-health').nextElementSibling).toBe(badge);
  expect(screen.getAllByTestId(/^drawer-item-/).length).toBeGreaterThanOrEqual(6);
  for (const item of screen.getAllByTestId(/^drawer-item-/)) {
    if (item.getAttribute('data-testid') !== 'drawer-item-health') expect(within(item).queryByTestId(/^drawer-badge-/)).toBeNull();
  }
  expect(screen.getAllByTestId('drawer-badge-health')).toHaveLength(1);
  rerender(drawer(120));
  expect(screen.getByTestId('drawer-badge-health').textContent).toBe('99+');
  rerender(drawer(0));
  expect(screen.queryByTestId('drawer-badge-health')).toBeNull();
});
