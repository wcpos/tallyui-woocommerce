import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { DrawerSheet } from '../components/drawer-content';
import { SOFTWARE_VERSION } from '../lib/software';

afterEach(() => { cleanup(); });

const itemIds = () => screen.getAllByTestId(/^drawer-item-/).map(el => el.getAttribute('data-testid'));

test('the drawer lists the areas in v2 order with Store health starting the bottom group, then the version', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} onOpenCustomers={vi.fn()} onOpenReports={vi.fn()}
    onOpenHealth={vi.fn()} onOpenLogs={vi.fn()} onOpenSettings={vi.fn()} /><PortalHost /></>);
  expect(itemIds()).toEqual(['drawer-item-pos', 'drawer-item-orders', 'drawer-item-customers', 'drawer-item-reports', 'drawer-item-health', 'drawer-item-logs', 'drawer-item-settings']);
  expect(screen.getAllByTestId(/^drawer-item-/).map(el => el.textContent)).toEqual(['POS', 'Orders', 'Customers', 'Reports', 'Store health', 'Logs', 'Settings']);
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
    onOpenHealth={() => calls.push('health')} onOpenLogs={() => calls.push('logs')} onOpenSettings={() => calls.push('settings')} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('drawer-item-pos'));
  expect(calls).toEqual(['open:false']);
});

test('an area without a handler has no item', () => {
  render(<><DrawerSheet open onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(itemIds()).toEqual(['drawer-item-pos', 'drawer-item-orders']);
});

test('a closed drawer renders nothing', () => {
  render(<><DrawerSheet open={false} onOpenChange={vi.fn()} onOpenOrders={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
});
