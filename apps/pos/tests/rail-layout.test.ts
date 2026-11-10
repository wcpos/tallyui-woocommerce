import { expect, test } from 'vitest';
import { railKeyForPath, railNavigation } from '../lib/layout/rail-routes';
import { isWideWindow } from '../lib/layout/wide';

test('isWideWindow: at least 768 wide and 480 tall, nothing in between', () => {
  expect(isWideWindow({ width: 768, height: 480 })).toBe(true);
  expect(isWideWindow({ width: 1280, height: 800 })).toBe(true);
  expect(isWideWindow({ width: 767, height: 480 })).toBe(false);
  expect(isWideWindow({ width: 768, height: 479 })).toBe(false);
  expect(isWideWindow({ width: 844, height: 390 })).toBe(false);
});

test('railKeyForPath: each area by its route, settings pages under settings, null elsewhere', () => {
  expect(railKeyForPath('/catalogue')).toBe('pos');
  expect(railKeyForPath('/orders')).toBe('orders');
  expect(railKeyForPath('/customers')).toBe('customers');
  expect(railKeyForPath('/reports')).toBe('reports');
  expect(railKeyForPath('/health')).toBe('health');
  expect(railKeyForPath('/logs')).toBe('logs');
  expect(railKeyForPath('/settings')).toBe('settings');
  expect(railKeyForPath('/settings/theme')).toBe('settings');
  for (const pathname of ['/', '/connect', '/auth/callback', '/ordersx']) expect(railKeyForPath(pathname)).toBeNull();
});

test('railNavigation: POS dismisses to the till, the till pushes an area, an area replaces an area, the same area does nothing', () => {
  expect(railNavigation('orders', 'orders')).toBeNull();
  expect(railNavigation('orders', 'pos')).toEqual({ method: 'dismissTo', href: '/catalogue' });
  expect(railNavigation('pos', 'orders')).toEqual({ method: 'push', href: '/orders' });
  expect(railNavigation('orders', 'customers')).toEqual({ method: 'replace', href: '/customers' });
  expect(railNavigation('health', 'settings')).toEqual({ method: 'replace', href: '/settings' });
});
