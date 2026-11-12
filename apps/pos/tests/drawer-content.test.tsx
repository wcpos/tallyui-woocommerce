import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { DrawerSheet } from '../components/drawer-content';
import { SOFTWARE_VERSION } from '../lib/software';
import { classesOf } from './classes-of';

afterEach(() => { cleanup(); });

const itemIds = () => screen.getAllByTestId(/^drawer-item-/).map(el => el.getAttribute('data-testid'));

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
